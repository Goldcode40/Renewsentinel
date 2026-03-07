import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    let body: any = null
    try {
      body = await req.json()
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
    }

    const userId = (body?.user_id ?? "").trim()
    const name = (body?.name ?? "Free Test Org").trim()

    if (!userId) return Response.json({ ok: false, error: "Missing user_id" }, { status: 400 })
    if (!name) return Response.json({ ok: false, error: "Missing name" }, { status: 400 })

    // 1) Create org in the real table: organizations
    const { data: orgRow, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        name,
        plan: "free",
        billing_status: "inactive",
        current_period_end: null,
      })
      .select("id,name,plan,billing_status,current_period_end,created_at")
      .single()

    if (orgErr || !orgRow?.id) {
      return Response.json({ ok: false, error: orgErr?.message ?? "Failed to create org", details: orgErr ?? null }, { status: 500 })
    }

    // 2) Create membership
    const { error: memErr } = await supabaseAdmin
      .from("org_members")
      .insert({
        org_id: orgRow.id,
        user_id: userId,
        role: "owner",
      })

    if (memErr) {
      // best-effort cleanup to avoid orphan orgs
      await supabaseAdmin.from("organizations").delete().eq("id", orgRow.id)
      return Response.json({ ok: false, error: memErr.message, details: memErr }, { status: 500 })
    }

    return Response.json({ ok: true, org: orgRow })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
