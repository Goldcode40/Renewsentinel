import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    return { supabaseAdmin: null as any, error: "Server misconfigured: missing Supabase admin env vars" };
  }

  const supabaseAdmin = createClient(url, service, {
    auth: { persistSession: false },
  });

  return { supabaseAdmin, error: null as string | null };
}

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const code = urlObj.searchParams.get("code") || "";
    const orgId = urlObj.searchParams.get("state") || ""; // we set this in auth-url
    const errorParam = urlObj.searchParams.get("error");

    if (errorParam) {
      return NextResponse.redirect(new URL(`/dashboard-premium?gcal=error&reason=${encodeURIComponent(errorParam)}`, urlObj.origin));
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/dashboard-premium?gcal=error&reason=missing_code`, urlObj.origin));
    }
    if (!orgId) {
      return NextResponse.redirect(new URL(`/dashboard-premium?gcal=error&reason=missing_org`, urlObj.origin));
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

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const tokenResp = await oauth2.getToken(code);
    const tokens = tokenResp.tokens;

    if (!tokens?.access_token) {
      return NextResponse.redirect(new URL(`/dashboard-premium?gcal=error&reason=token_exchange_failed`, urlObj.origin));
    }

    const { supabaseAdmin, error: cfgErr } = getSupabaseAdmin();
    if (cfgErr) {
      return NextResponse.json({ ok: false, error: cfgErr }, { status: 500 });
    }

    // Store tokens in a simple table (we'll add the table next step)
    const payload = {
      org_id: orgId,
      provider: "google",
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
      expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabaseAdmin
      .from("oauth_tokens")
      .upsert(payload, { onConflict: "org_id,provider" });

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message, details: upsertErr }, { status: 500 });
    }

    return NextResponse.redirect(new URL(`/dashboard-premium?gcal=connected`, urlObj.origin));
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}