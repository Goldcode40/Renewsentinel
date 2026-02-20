import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)

    const orgId = (url.searchParams.get("org_id") ?? "").trim()
    const itemId = (url.searchParams.get("item_id") ?? "").trim()

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!itemId) return Response.json({ ok: false, error: "Missing item_id" }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from("item_documents")
      .select("id, org_id, item_id, filename, content_type, size_bytes, storage_bucket, storage_path, created_at")
      .eq("org_id", orgId)
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

    return Response.json({ ok: true, documents: data ?? [] })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
