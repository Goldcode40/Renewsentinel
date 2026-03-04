import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

export const runtime = "nodejs"

// Multipart form POST
// fields: org_id, policy_id, file
export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const form = await req.formData()
    const orgId = String(form.get("org_id") ?? "").trim()
    const policyId = String(form.get("policy_id") ?? "").trim()
    const file = form.get("file")

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    // HARD GATE: Insurance Upload is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabaseAdmin as any, orgId)
    if (!gate.ok) {
      return Response.json(
        { ok: false, error: "Upgrade required", reason: gate.reason, org: gate.org ?? null },
        { status: 403 }
      )
    }

    if (!policyId) return Response.json({ ok: false, error: "Missing policy_id" }, { status: 400 })
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Missing file" }, { status: 400 })

    const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_")
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin"
    const objectPath = `org/${orgId}/insurance/${policyId}/${crypto.randomUUID()}.${ext}`

    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabaseAdmin.storage
      .from("insurance-docs")
      .upload(objectPath, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 })

    // Update policy row to attach file info
    const { data, error } = await supabaseAdmin
      .from("insurance_policies")
      .update({
        document_bucket: "insurance-docs",
        document_path: objectPath,
        document_filename: safeName,
        document_content_type: file.type || null,
        document_size_bytes: typeof file.size === "number" ? file.size : null,
      })
      .eq("id", policyId)
      .eq("org_id", orgId)
      .select("id,org_id,provider,policy_number,policy_type,effective_date,expiry_date,coverage_amount,document_bucket,document_path,document_filename,document_content_type,document_size_bytes,notes,created_at,updated_at")
      .single()

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

    return Response.json({ ok: true, policy: data })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
