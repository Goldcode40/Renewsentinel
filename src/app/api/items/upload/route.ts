import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const form = await req.formData()
    const orgId = String(form.get("org_id") ?? "").trim()
    const itemId = String(form.get("item_id") ?? "").trim()
    const file = form.get("file")

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!itemId) return Response.json({ ok: false, error: "Missing item_id" }, { status: 400 })
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Missing file" }, { status: 400 })

    const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_")
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin"
    const objectPath = `org/${orgId}/item/${itemId}/${crypto.randomUUID()}.${ext}`

    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabaseAdmin.storage
      .from("item-docs")
      .upload(objectPath, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (upErr) {
      return Response.json({ ok: false, error: upErr.message }, { status: 500 })
    }

    const docRow = {
      org_id: orgId,
      item_id: itemId,
      storage_bucket: "item-docs",
      storage_path: objectPath,
      filename: safeName,
      content_type: file.type || null,
      size_bytes: typeof file.size === "number" ? file.size : null,
    }

    const { data, error: insErr } = await supabaseAdmin
      .from("item_documents")
      .insert(docRow)
      .select("id, org_id, item_id, storage_bucket, storage_path, filename, content_type, size_bytes, created_at")
      .single()

    if (insErr) {
      return Response.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    return Response.json({ ok: true, document: data })

    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}

