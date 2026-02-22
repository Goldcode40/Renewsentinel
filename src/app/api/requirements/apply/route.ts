import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  org_id?: string
  template_id?: string
  expires_on?: string // YYYY-MM-DD
}

function mapRequirementTypeToItemType(reqType: string): "license" | "cert" | "insurance" | "permit" {
  const t = (reqType || "").toLowerCase().trim()
  if (t === "cert" || t === "certification") return "cert"
  if (t === "insurance") return "insurance"
  if (t === "permit") return "permit"
  // default
  return "license"
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as Body

    const orgId = (body.org_id ?? "").trim()
    const templateId = (body.template_id ?? "").trim()
    const expiresOn = (body.expires_on ?? "").trim()

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!templateId) return Response.json({ ok: false, error: "Missing template_id" }, { status: 400 })
    if (!expiresOn) return Response.json({ ok: false, error: "Missing expires_on (YYYY-MM-DD)" }, { status: 400 })

    // Load template (from underlying table)
    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("requirement_templates")
      .select(
        "id,name,title,issuer,requirement_type,description,default_renewal_window_days,default_reminder_offsets_days,required_docs"
      )
      .eq("id", templateId)
      .eq("is_active", true)
      .single()

    if (tplErr || !tpl) {
      return Response.json({ ok: false, error: tplErr?.message ?? "Template not found" }, { status: 404 })
    }

    const itemType = mapRequirementTypeToItemType(tpl.requirement_type ?? "")
    const title = (tpl.title ?? tpl.name ?? "").trim()
    const issuer = (tpl.issuer ?? null) as string | null
    const renewalWindowDays =
      typeof tpl.default_renewal_window_days === "number" ? tpl.default_renewal_window_days : 30

    // Create compliance item
    const { data: item, error: itemErr } = await supabaseAdmin
      .from("compliance_items")
      .insert({
        org_id: orgId,
        type: itemType,
        title,
        issuer,
        expires_on: expiresOn,
        renewal_window_days: renewalWindowDays,
        notes: tpl.description ?? null,
      })
      .select("id, org_id, type, title, expires_on, renewal_window_days, status, created_at")
      .single()

    if (itemErr || !item) {
      return Response.json({ ok: false, error: itemErr?.message ?? "Failed to create item" }, { status: 500 })
    }

    // Link item to template (best effort)
    try {
      await supabaseAdmin.from("compliance_item_requirements").insert({
        org_id: orgId,
        compliance_item_id: item.id,
        org_requirement_id: templateId, // NOTE: linking to template for now; we'll introduce org_requirements in the wizard next
      })
    } catch (_) {
      // ignore
    }

    // Audit log (v0)
    try {
      await supabaseAdmin.from("audit_log_events").insert({
        org_id: orgId,
        actor_user_id: "00000000-0000-0000-0000-000000000001",
        actor_role: "owner",
        action: "requirement.applied",
        entity_type: "requirement_template",
        entity_id: templateId,
        details: { compliance_item_id: item.id, title, expires_on: expiresOn },
      })
    } catch (_) {
      // ignore
    }

    return Response.json({ ok: true, item })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
