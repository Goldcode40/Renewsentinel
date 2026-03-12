import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveOrTrial } from "@/lib/billingGate";

function extractDates(text: string) {
  const hits = new Set<string>();

  // ISO date: 2026-03-01
  for (const m of text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) hits.add(m[1]);

  // US date: 03/01/2026 or 3/1/2026
  for (const m of text.matchAll(/\b(\d{1,2}\/\d{1,2}\/20\d{2})\b/g)) hits.add(m[1]);

  return Array.from(hits);
}

function normalizeParsedExpiryDate(dates: string[]): string | null {
  if (!dates.length) return null;

  const first = dates[0];

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    return first;
  }

  // US date -> ISO
  const m = first.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id") || "";
    const q = searchParams.get("q") || "newer_than:365d";

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { ok: false, error: "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI" },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    // HARD GATE: Email Expiries Scan is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabase as any, orgId);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      );
    }

    const { data: tok, error: tokErr } = await supabase
      .from("oauth_tokens")
      .select("access_token, refresh_token, expiry_date")
      .eq("org_id", orgId)
      .eq("provider", "google")
      .maybeSingle();

    if (tokErr) throw tokErr;
    if (!tok?.refresh_token) {
      return NextResponse.json({ ok: false, error: "No Google token for org" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      access_token: tok.access_token || undefined,
      refresh_token: tok.refresh_token || undefined,
      expiry_date: tok.expiry_date ? new Date(tok.expiry_date).getTime() : undefined,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const list = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 5,
    });

    const ids = (list.data.messages || []).map((m) => m.id).filter(Boolean) as string[];
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, org_id: orgId, q, found: 0, stored: 0, messages: [] });
    }

    const persisted: any[] = [];

    for (const id of ids) {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      const headers = msg.data.payload?.headers || [];
      const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
      const dateHdr = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
      const fromEmail = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
      const snippet = msg.data.snippet || "";
      const gmailThreadId = msg.data.threadId || null;

      const textBlob = [subject, dateHdr, snippet].filter(Boolean).join("\n");
      const dates = extractDates(textBlob);
      const parsedExpiryDate = normalizeParsedExpiryDate(dates);

      const upsertRes = await supabase
        .from("email_expiries")
        .upsert(
          {
            org_id: orgId,
            gmail_message_id: id,
            gmail_thread_id: gmailThreadId,
            from_email: fromEmail,
            subject,
            gmail_date_header: dateHdr,
            snippet,
            parsed_expiry_date: parsedExpiryDate,
          },
          { onConflict: "org_id,gmail_message_id" }
        )
        .select("id, gmail_message_id, subject, parsed_expiry_date, matched_item_id, created_at")
        .single();

      if (upsertRes.error) {
        throw upsertRes.error;
      }

      persisted.push({
        id: upsertRes.data.id,
        gmail_message_id: upsertRes.data.gmail_message_id,
        subject: upsertRes.data.subject,
        parsed_expiry_date: upsertRes.data.parsed_expiry_date,
        matched_item_id: upsertRes.data.matched_item_id,
        created_at: upsertRes.data.created_at,
        extracted_dates: dates,
      });
    }

    // Persist refreshed token if changed
    const creds: any = oauth2Client.credentials;
    if (creds.access_token && creds.access_token !== tok.access_token) {
      await supabase
        .from("oauth_tokens")
        .upsert(
          {
            org_id: orgId,
            provider: "google",
            access_token: creds.access_token,
            refresh_token: creds.refresh_token || tok.refresh_token,
            expiry_date: creds.expiry_date ? new Date(creds.expiry_date).toISOString() : tok.expiry_date,
          },
          { onConflict: "org_id,provider" }
        );
    }

    return NextResponse.json({
      ok: true,
      org_id: orgId,
      q,
      found: ids.length,
      stored: persisted.length,
      sample: persisted[0] ?? null,
      messages: persisted,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

