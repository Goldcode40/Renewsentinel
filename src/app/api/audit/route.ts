import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)

    const orgId = (url.searchParams.get("org_id") ?? "").trim()
    const limitParam = (url.searchParams.get("limit") ?? "50").trim()
    const limit = Math.max(1, Math.min(500, parseInt(limitParam, 10) || 50))

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from("audit_log_events")
      .select("id, org_id, actor_user_id, actor_role, action, entity_type, entity_id, details, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

    return Response.json({ ok: true, events: data ?? [] })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
