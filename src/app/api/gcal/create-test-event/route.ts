import { NextResponse } from "next/server"
import { google } from "googleapis"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

function pickOrgId(req: Request, rawBody: string | null) {
  const { searchParams } = new URL(req.url)
  const fromQuery = searchParams.get("org_id")
  if (fromQuery) return fromQuery

  if (!rawBody) return null

  // Try JSON
  try {
    const j = JSON.parse(rawBody)
    if (j?.org_id) return String(j.org_id)
  } catch {}

  // Try x-www-form-urlencoded (just in case)
  try {
    const params = new URLSearchParams(rawBody)
    const v = params.get("org_id")
    if (v) return v
  } catch {}

  return null
}

export async function POST(req: Request) {
  const rawBody = await req.text().catch(() => "")
  const orgId = pickOrgId(req, rawBody)

  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

    // HARD GATE: GCAL Create Test Event is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabaseAdmin as any, fromQuery)
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required", reason: gate.reason, org: gate.org ?? null },
        { status: 403 }
      )
    }


  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("oauth_tokens")
    .select("access_token, refresh_token, expiry_date")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .maybeSingle()

  if (tokenErr) {
    return NextResponse.json({ ok: false, error: tokenErr.message }, { status: 500 })
  }
  if (!tokenRow?.access_token || !tokenRow?.refresh_token) {
    return NextResponse.json({ ok: false, error: "Google Calendar not connected for this org" }, { status: 400 })
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date ? new Date(tokenRow.expiry_date).getTime() : undefined,
  })

  // Auto-refresh if needed
  try {
    const now = Date.now()
    const exp = tokenRow.expiry_date ? new Date(tokenRow.expiry_date).getTime() : 0
    if (exp && exp - now < 60_000) {
      const refreshed = await oauth2Client.refreshAccessToken()
      const creds = refreshed.credentials

      await supabaseAdmin.from("oauth_tokens").upsert({
        org_id: orgId,
        provider: "google",
        access_token: creds.access_token ?? tokenRow.access_token,
        refresh_token: creds.refresh_token ?? tokenRow.refresh_token,
        scope: creds.scope ?? null,
        token_type: creds.token_type ?? null,
        expiry_date: creds.expiry_date ? new Date(creds.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
    }
  } catch {
    // If refresh fails, we still try with existing access token
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client })

  const start = new Date(Date.now() + 5 * 60_000)
  const end = new Date(start.getTime() + 15 * 60_000)

  const resp = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `RenewSentinel Test Event (${new Date().toISOString()})`,
      description: "Created by RenewSentinel integration test route",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  })

  return NextResponse.json({
    ok: true,
    eventId: resp.data.id,
    htmlLink: resp.data.htmlLink,
    summary: resp.data.summary,
    start: resp.data.start?.dateTime,
    end: resp.data.end?.dateTime,
  })
}
