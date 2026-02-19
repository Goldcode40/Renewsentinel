import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const url = new URL(req.url)
    const orgId = (url.searchParams.get("org_id") ?? "").trim()

    if (!orgId) {
      return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("compliance_items")
      .select("id, org_id, type, title, issuer, identifier, expires_on, renewal_window_days, status, created_at, updated_at")
      .eq("org_id", orgId)
      .order("expires_on", { ascending: true })

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, items: data ?? [] })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
