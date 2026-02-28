import { NextResponse } from "next/server"
import { google } from "googleapis"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

const TZ = "America/Moncton"

function toIsoAtLocalTime(dateOnly: string, hour: number, minute: number) {
  // dateOnly = YYYY-MM-DD
  // We store as an ISO with explicit offset by constructing in UTC-like and letting Google use timeZone.
  // Google Calendar accepts { dateTime, timeZone } and will render correctly.
  const [y, m, d] = dateOnly.split("-").map((v) => parseInt(v, 10))
  const dt = new Date(Date.UTC(y, m - 1, d, hour, minute, 0))
  return dt.toISOString()
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get("org_id")
    const itemId = searchParams.get("item_id")

    if (!orgId || !itemId) {
      return NextResponse.json({ ok: false, error: "Missing org_id or item_id" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1) Load compliance item (match your schema: expires_on, no description)
    const { data: item, error: itemErr } = await supabase
      .from("compliance_items")
      .select("id, org_id, type, title, expires_on, renewal_window_days, status, created_at")
      .eq("org_id", orgId)
      .eq("id", itemId)
      .single()

    if (itemErr || !item) {
      return NextResponse.json({ ok: false, error: itemErr?.message || "Item not found" }, { status: 404 })
    }

    if (!item.expires_on) {
      return NextResponse.json({ ok: false, error: "Item has no expires_on date" }, { status: 400 })
    }

    // 2) Load OAuth token for Google
    const { data: tok, error: tokErr } = await supabase
      .from("oauth_tokens")
      .select("access_token, refresh_token, scope, token_type, expiry_date")
      .eq("org_id", orgId)
      .eq("provider", "google")
      .maybeSingle()

    if (tokErr) {
      return NextResponse.json({ ok: false, error: tokErr.message }, { status: 500 })
    }
    if (!tok?.access_token) {
      return NextResponse.json({ ok: false, error: "Google Calendar not connected for this org" }, { status: 400 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ ok: false, error: "Missing GOOGLE_* env vars" }, { status: 500 })
    }

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    oAuth2Client.setCredentials({
      access_token: tok.access_token || undefined,
      refresh_token: tok.refresh_token || undefined,
      scope: tok.scope || undefined,
      token_type: tok.token_type || undefined,
      expiry_date: tok.expiry_date ? new Date(tok.expiry_date).getTime() : undefined,
    })

    // If refresh is available, googleapis will refresh automatically on request.
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client })

    // 3) Look for existing mapping
    const { data: link } = await supabase
      .from("gcal_event_links")
      .select("event_id, calendar_id")
      .eq("org_id", orgId)
      .eq("item_id", itemId)
      .maybeSingle()

    const calendarId = link?.calendar_id || "primary"

    // 4) Build event payload
    const summary = `RenewSentinel: ${item.title}`
    const details = [
      `Type: ${item.type || "n/a"}`,
      `Status: ${item.status || "n/a"}`,
      `Expires On: ${item.expires_on}`,
      `Renewal Window (days): ${item.renewal_window_days ?? "n/a"}`,
      "",
      `Item ID: ${item.id}`,
      `Org ID: ${item.org_id}`,
    ].join("\n")

    const startIso = toIsoAtLocalTime(item.expires_on, 9, 0)
    const endIso = toIsoAtLocalTime(item.expires_on, 9, 30)

    const eventBody = {
      summary,
      description: details,
      start: { dateTime: startIso, timeZone: TZ },
      end: { dateTime: endIso, timeZone: TZ },
      reminders: { useDefault: true },
    }

    // 5) Create or update in Google Calendar
    let eventId: string | undefined
    let htmlLink: string | undefined

    if (link?.event_id) {
      const upd = await calendar.events.update({
        calendarId,
        eventId: link.event_id,
        requestBody: eventBody,
      })
      eventId = upd.data.id || link.event_id
      htmlLink = upd.data.htmlLink || undefined
    } else {
      const ins = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      })
      eventId = ins.data.id || undefined
      htmlLink = ins.data.htmlLink || undefined

      if (eventId) {
        // store mapping
        await supabase
          .from("gcal_event_links")
          .upsert(
            { org_id: orgId, item_id: itemId, provider: "google", calendar_id: calendarId, event_id: eventId },
            { onConflict: "org_id,item_id,provider" }
          )
      }
    }

    if (!eventId) {
      return NextResponse.json({ ok: false, error: "Google did not return an event id" }, { status: 500 })
    }

    // 6) Persist refreshed tokens if Google rotated them
    const creds = oAuth2Client.credentials
    if (creds.access_token && creds.access_token !== tok.access_token) {
      await supabase
        .from("oauth_tokens")
        .upsert(
          {
            org_id: orgId,
            provider: "google",
            access_token: creds.access_token,
            refresh_token: creds.refresh_token ?? tok.refresh_token ?? null,
            scope: creds.scope ?? tok.scope ?? null,
            token_type: creds.token_type ?? tok.token_type ?? null,
            expiry_date: creds.expiry_date ? new Date(creds.expiry_date).toISOString() : tok.expiry_date ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,provider" }
        )
    }

    return NextResponse.json({
      ok: true,
      org_id: orgId,
      item_id: itemId,
      calendar_id: calendarId,
      event_id: eventId,
      htmlLink,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 })
  }
}