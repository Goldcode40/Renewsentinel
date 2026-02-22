import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  org_id?: string
  profile_state?: string
  profile_trade?: string
}

export async function PATCH(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as Body

    const orgId = (body.org_id ?? "").trim()
    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    const profileState = (body.profile_state ?? "").trim().toUpperCase()
    const profileTrade = (body.profile_trade ?? "").trim().toLowerCase()

    const patch: any = {}
    if (profileState) patch.profile_state = profileState
    if (profileTrade) patch.profile_trade = profileTrade

    if (Object.keys(patch).length === 0) {
      return Response.json({ ok: false, error: "No fields to update" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update(patch)
      .eq("id", orgId)
      .select("id,name,profile_state,profile_trade,created_at")
      .single()

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Audit log (best effort)
    try {
      await supabaseAdmin.from("audit_log_events").insert({
        org_id: orgId,
        actor_user_id: "00000000-0000-0000-0000-000000000001",
        actor_role: "owner",
        action: "org.profile.updated",
        entity_type: "organization",
        entity_id: orgId,
        details: patch,
      })
    } catch (_) {
      // ignore
    }

    return Response.json({ ok: true, org: data })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
