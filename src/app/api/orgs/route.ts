import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { searchParams } = new URL(req.url)
    const userId = (searchParams.get("user_id") ?? "").trim()

    if (!userId) {
      return Response.json({ ok: false, error: "Missing user_id" }, { status: 400 })
    }

    // Fetch org memberships for user, with org details
    const { data, error } = await supabaseAdmin
      .from("org_members")
      .select("role, org:organizations(id,name,created_at)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    const orgs =
      (data ?? []).map((row: any) => ({
        role: row.role,
        ...row.org,
      })) ?? []

    return Response.json({ ok: true, orgs })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
