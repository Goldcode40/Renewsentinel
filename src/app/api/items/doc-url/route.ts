import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)

    const orgId = (url.searchParams.get("org_id") ?? "").trim()
    const docId = (url.searchParams.get("doc_id") ?? "").trim()
    const expiresParam = (url.searchParams.get("expires") ?? "600").trim()
    const expiresIn = Math.max(60, Math.min(3600, parseInt(expiresParam, 10) || 600))

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!docId) return Response.json({ ok: false, error: "Missing doc_id" }, { status: 400 })

    const { data: doc, error: docErr } = await supabaseAdmin
      .from("item_documents")
      .select("id, org_id, storage_bucket, storage_path, filename")
      .eq("id", docId)
      .eq("org_id", orgId)
      .single()

    if (docErr) return Response.json({ ok: false, error: docErr.message }, { status: 500 })
    if (!doc) return Response.json({ ok: false, error: "Not found" }, { status: 404 })

    const { data, error } = await supabaseAdmin.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, expiresIn)

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

    return Response.json({ ok: true, url: data?.signedUrl ?? null, filename: doc.filename, expires_in: expiresIn })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
