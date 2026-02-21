import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  org_id?: string
  type?: "license" | "cert" | "insurance" | "permit"
  title?: string
  issuer?: string
  identifier?: string
  expires_on?: string // YYYY-MM-DD
  renewal_window_days?: number
  notes?: string
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as Body

    const orgId = (body.org_id ?? "").trim()
    const type = body.type ?? "license"
    const title = (body.title ?? "").trim()
    const expiresOn = (body.expires_on ?? "").trim()

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!title) return Response.json({ ok: false, error: "Missing title" }, { status: 400 })
    if (!expiresOn) return Response.json({ ok: false, error: "Missing expires_on (YYYY-MM-DD)" }, { status: 400 })

    const payload = {
      org_id: orgId,
      type,
      title,
      issuer: body.issuer ?? null,
      identifier: body.identifier ?? null,
      expires_on: expiresOn,
      renewal_window_days: body.renewal_window_days ?? 30,
      notes: body.notes ?? null,
      // status left as default 'green' for now (status engine comes next)
    }

    const { data, error } = await supabaseAdmin
      .from("compliance_items")
      .insert(payload)
      .select("id, org_id, type, title, expires_on, renewal_window_days, status, created_at")
      .single()

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Audit log (v0)
    await supabaseAdmin.from("audit_log_events").insert({
      org_id: orgId,
      actor_user_id: "00000000-0000-0000-0000-000000000001",
      actor_role: "owner",
      action: "item.created",
      entity_type: "compliance_item",
      entity_id: data.id,
      details: {
        type: data.type,
        title: data.title,
        expires_on: data.expires_on,
      },
    })
    return Response.json({ ok: true, item: data })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}

