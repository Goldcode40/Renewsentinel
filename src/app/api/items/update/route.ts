import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  id?: string
  org_id?: string

  type?: "license" | "cert" | "insurance" | "permit"
  title?: string
  issuer?: string
  identifier?: string
  expires_on?: string // YYYY-MM-DD
  renewal_window_days?: number
  notes?: string
  status?: "green" | "yellow" | "red"
}

export async function PATCH(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as Body

    const id = (body.id ?? "").trim()
    const orgId = (body.org_id ?? "").trim()

    if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 })
    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    // Build a minimal update payload: only include fields the caller actually sent
    const updates: Record<string, any> = {}

    if (typeof body.type === "string") updates.type = body.type
    if (typeof body.title === "string") updates.title = body.title.trim()
    if (typeof body.issuer === "string") updates.issuer = body.issuer.trim()
    if (typeof body.identifier === "string") updates.identifier = body.identifier.trim()
    if (typeof body.expires_on === "string") updates.expires_on = body.expires_on.trim()
    if (typeof body.renewal_window_days === "number") updates.renewal_window_days = body.renewal_window_days
    if (typeof body.notes === "string") updates.notes = body.notes
    if (typeof body.status === "string") updates.status = body.status

    // Nothing to update?
    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: false, error: "No updatable fields provided" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("compliance_items")
      .update(updates)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id, org_id, type, title, issuer, identifier, expires_on, renewal_window_days, status, created_at, updated_at")
      .single()

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!data) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return Response.json({ ok: true, item: data })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
