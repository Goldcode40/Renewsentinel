import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

export const runtime = "nodejs"

// Multipart form POST
// fields: org_id, subcontractor_id, doc_id (optional), file
export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const form = await req.formData()
    const orgId = String(form.get("org_id") ?? "").trim()

    // HARD GATE: Subcontractor Docs Upload is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabaseAdmin as any, orgId)
    if (!gate.ok) {
      return Response.json(
        { ok: false, error: "Upgrade required", reason: gate.reason, org: gate.org ?? null },
        { status: 403 }
      )
    }

    const subcontractorId = String(form.get("subcontractor_id") ?? "").trim()
    const docId = String(form.get("doc_id") ?? "").trim() // optional (existing row)
    const file = form.get("file")

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!subcontractorId) return Response.json({ ok: false, error: "Missing subcontractor_id" }, { status: 400 })
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Missing file" }, { status: 400 })

    const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_")
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin"
    const objectPath = `org/${orgId}/sub/${subcontractorId}/doc/${crypto.randomUUID()}.${ext}`

    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabaseAdmin.storage
      .from("subcontractor-docs")
      .upload(objectPath, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (upErr) {
      return Response.json({ ok: false, error: upErr.message }, { status: 500 })
    }

    // If doc_id provided: update existing row to attach file info.
    // Else: create a new row with doc_type="other" and attach file info.
    if (docId) {
      const { data, error } = await supabaseAdmin
        .from("subcontractor_documents")
        .update({
          storage_bucket: "subcontractor-docs",
          storage_path: objectPath,
          filename: safeName,
          content_type: file.type || null,
          size_bytes: typeof file.size === "number" ? file.size : null,
        })
        .eq("id", docId)
        .eq("org_id", orgId)
        .eq("subcontractor_id", subcontractorId)
        .select("id, org_id, subcontractor_id, doc_type, title, expires_on, filename, content_type, size_bytes, storage_bucket, storage_path, created_at, updated_at")
        .single()

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
      return Response.json({ ok: true, document: data })
    } else {
      const docRow = {
        org_id: orgId,
        subcontractor_id: subcontractorId,
        doc_type: "other",
        title: safeName,
        expires_on: null,
        storage_bucket: "subcontractor-docs",
        storage_path: objectPath,
        filename: safeName,
        content_type: file.type || null,
        size_bytes: typeof file.size === "number" ? file.size : null,
      }

      const { data, error } = await supabaseAdmin
        .from("subcontractor_documents")
        .insert(docRow)
        .select("id, org_id, subcontractor_id, doc_type, title, expires_on, filename, content_type, size_bytes, storage_bucket, storage_path, created_at, updated_at")
        .single()

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
      return Response.json({ ok: true, document: data })
    }
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
