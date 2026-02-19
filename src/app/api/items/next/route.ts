import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

function toDateOnly(d: Date) {
  // normalize to YYYY-MM-DD in UTC (treat expires_on as date-only)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function parseDateOnly(s: string): Date {
  // "YYYY-MM-DD" -> Date at UTC midnight
  return new Date(`${s}T00:00:00.000Z`)
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function computeStatus(expiresOn: string, renewalWindowDays: number | null | undefined) {
  const today = parseDateOnly(toDateOnly(new Date()))
  const exp = parseDateOnly(expiresOn)
  const daysLeft = daysBetween(today, exp)

  const windowDays = typeof renewalWindowDays === "number" ? renewalWindowDays : 30

  // red: expired or expiring in <= 0 days
  if (daysLeft <= 0) return { status: "red", days_left: daysLeft }

  // yellow: within renewal window
  if (daysLeft <= windowDays) return { status: "yellow", days_left: daysLeft }

  return { status: "green", days_left: daysLeft }
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const url = new URL(req.url)
    const orgId = (url.searchParams.get("org_id") ?? "").trim()
    const daysParam = (url.searchParams.get("days") ?? "90").trim()
    const maxDays = Math.max(1, Math.min(3650, parseInt(daysParam, 10) || 90))

    if (!orgId) {
      return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("compliance_items")
      .select("id, org_id, type, title, issuer, identifier, expires_on, renewal_window_days, created_at, updated_at")
      .eq("org_id", orgId)
      .order("expires_on", { ascending: true })

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    const items = (data ?? [])
      .map((it: any) => {
        const computed = computeStatus(it.expires_on, it.renewal_window_days)
        return { ...it, ...computed }
      })
      .filter((it: any) => it.days_left <= maxDays)

    return Response.json({ ok: true, days: maxDays, items })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
