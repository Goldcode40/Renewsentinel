import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)

    const orgId = (url.searchParams.get("org_id") ?? "").trim()
    const itemId = (url.searchParams.get("item_id") ?? "").trim()

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!itemId) return Response.json({ ok: false, error: "Missing item_id" }, { status: 400 })

    // Latest doc
    const { data: latest, error: latestErr } = await supabaseAdmin
      .from("item_documents")
      .select("id, filename, created_at")
      .eq("org_id", orgId)
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestErr) return Response.json({ ok: false, error: latestErr.message }, { status: 500 })

    // Count docs (use an exact count)
    const { count, error: countErr } = await supabaseAdmin
      .from("item_documents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("item_id", itemId)

    if (countErr) return Response.json({ ok: false, error: countErr.message }, { status: 500 })

    return Response.json({ ok: true, count: count ?? 0, latest: latest ?? null })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
