import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  org_id?: string
  doc_id?: string
}

export async function DELETE(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as Body

    const orgId = (body.org_id ?? "").trim()
    const docId = (body.doc_id ?? "").trim()

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!docId) return Response.json({ ok: false, error: "Missing doc_id" }, { status: 400 })

    // 1) Load document row
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("item_documents")
      .select("id, org_id, storage_bucket, storage_path")
      .eq("id", docId)
      .eq("org_id", orgId)
      .single()

    if (docErr) return Response.json({ ok: false, error: docErr.message }, { status: 500 })
    if (!doc) return Response.json({ ok: false, error: "Not found" }, { status: 404 })

    // 2) Delete storage object
    const { error: rmErr } = await supabaseAdmin.storage.from(doc.storage_bucket).remove([doc.storage_path])
    if (rmErr) return Response.json({ ok: false, error: rmErr.message }, { status: 500 })

    // 3) Delete DB row
    const { error: delErr } = await supabaseAdmin
      .from("item_documents")
      .delete()
      .eq("id", docId)
      .eq("org_id", orgId)

    if (delErr) return Response.json({ ok: false, error: delErr.message }, { status: 500 })

    return Response.json({ ok: true, deleted: { id: docId } })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
