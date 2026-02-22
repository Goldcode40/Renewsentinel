import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  org_name?: string
  user_id?: string
}


type ExistingMemberRow = {
  role: string
  org: { id: string; name: string; created_at: string } | null
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const body = (await req.json().catch(() => ({}))) as Body
    const orgName = (body.org_name ?? "").trim()
    const userId = (body.user_id ?? "").trim()

    if (!orgName) return Response.json({ ok: false, error: "Missing org_name" }, { status: 400 })
    if (!userId) return Response.json({ ok: false, error: "Missing user_id" }, { status: 400 })


    // 1) If user already has an org membership, return that org (idempotent behavior)
    const existingRes = await supabaseAdmin
      .from("org_members")
      .select("role, org:organizations(id,name,created_at)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)

    const existing = (existingRes.data as ExistingMemberRow[] | null) ?? null
    const existingErr = existingRes.error

    if (existingErr) {
      return Response.json({ ok: false, error: existingErr.message }, { status: 500 })
    }

    const first = (existing ?? [])[0]
    if (first?.org?.id) {
      return Response.json({
        ok: true,
        org: first.org,
        member: { user_id: userId, role: first.role },
        reused: true,
      })
    }

    // 2) Otherwise create org
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: orgName })
      .select("id,name,created_at")
      .single()

    if (orgErr || !org) {
      return Response.json({ ok: false, error: orgErr?.message ?? "Failed to create org" }, { status: 500 })
    }

    // 3) Create membership as owner
    const { error: memErr } = await supabaseAdmin.from("org_members").insert({
      org_id: org.id,
      user_id: userId,
      role: "owner",
    })

    if (memErr) {
      return Response.json({ ok: false, error: memErr.message }, { status: 500 })
    }

    return Response.json({ ok: true, org, member: { user_id: userId, role: "owner" }, reused: false })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}


