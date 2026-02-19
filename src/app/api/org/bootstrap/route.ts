import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const body = await req.json().catch(() => ({}))
    const orgName = (body?.org_name ?? "My Company").toString().trim()
    const userId = (body?.user_id ?? "").toString().trim()

    if (!userId) {
      return Response.json(
        { ok: false, error: "Missing user_id (temporary dev bootstrap)" },
        { status: 400 }
      )
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: orgName })
      .select("id,name,created_at")
      .single()

    if (orgErr || !org) {
      return Response.json(
        { ok: false, error: orgErr?.message ?? "org create failed" },
        { status: 500 }
      )
    }

    const { error: memErr } = await supabaseAdmin
      .from("org_members")
      .insert({ org_id: org.id, user_id: userId, role: "owner" })

    if (memErr) {
      return Response.json({ ok: false, error: memErr.message }, { status: 500 })
    }

    return Response.json({ ok: true, org })
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message ?? "unknown error" },
      { status: 500 }
    )
  }
}
