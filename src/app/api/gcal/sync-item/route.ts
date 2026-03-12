import { NextResponse } from "next/server"
import { google } from "googleapis"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

const ENTITY_TYPE = "compliance_item"

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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

    // HARD GATE: GCAL Sync Item is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabase as any, orgId)
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      )
    }


    // 1) Fetch item (minimal fields)
    const { data: item, error: itemErr } = await supabase
      .from("compliance_items")
      .select("id, title, type, expires_on")
      .eq("org_id", orgId)
      .eq("id", itemId)
      .maybeSingle()

    if (itemErr) throw itemErr
    if (!item) return NextResponse.json({ ok: false, error: "Item not found" }, { status: 404 })

    // 2) Load Google token
    const { data: tok, error: tokErr } = await supabase
      .from("oauth_tokens")
      .select("access_token, refresh_token, expiry_date")
      .eq("org_id", orgId)
      .eq("provider", "google")
      .maybeSingle()

    if (tokErr) throw tokErr
    if (!tok?.refresh_token) {
      return NextResponse.json({ ok: false, error: "No Google token for org" }, { status: 400 })
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: tok.access_token || undefined,
      refresh_token: tok.refresh_token || undefined,
      expiry_date: tok.expiry_date ? new Date(tok.expiry_date).getTime() : undefined,
    })

    const calendar = google.calendar({ version: "v3", auth: oauth2Client })

    // 3) Look for existing mapping (CORRECT columns)
    const { data: link, error: linkErr } = await supabase
      .from("gcal_event_links")
      .select("event_id, calendar_id")
      .eq("org_id", orgId)
      .eq("entity_type", ENTITY_TYPE)
      .eq("entity_id", itemId)
      .maybeSingle()

    if (linkErr) throw linkErr

    const calendarId = link?.calendar_id || "primary"

    // 4) Create an all-day event on the expires_on date
    const date = item.expires_on
    const eventBody: any = {
      summary: `RenewSentinel: ${item.title}`,
      description: [
        `Type: ${item.type || ""}`,
        `Expires On: ${item.expires_on}`,
        `Item ID: ${item.id}`,
      ].filter(Boolean).join("\n"),
      start: { date },
      end: { date: addDays(date, 1) },
    }

    // 5) Create or update Google Calendar event
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
    }

    if (!eventId) {
      return NextResponse.json({ ok: false, error: "Google did not return event_id" }, { status: 500 })
    }

    // 6) Upsert mapping (ALWAYS) using correct schema + key
    const { error: upErr } = await supabase
      .from("gcal_event_links")
      .upsert(
        {
          org_id: orgId,
          entity_type: ENTITY_TYPE,
          entity_id: itemId,
          calendar_id: calendarId,
          event_id: eventId,
        },
        { onConflict: "org_id,entity_type,entity_id" }
      )

    if (upErr) throw upErr

    // 7) Persist refreshed token if it changed
    const creds: any = oauth2Client.credentials
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

