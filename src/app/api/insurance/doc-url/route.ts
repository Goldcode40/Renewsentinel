import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)

    const orgId = (url.searchParams.get("org_id") ?? "").trim()
    const policyId = (url.searchParams.get("policy_id") ?? "").trim()
    const expiresParam = (url.searchParams.get("expires") ?? "600").trim()
    const expiresIn = Math.max(60, Math.min(3600, parseInt(expiresParam, 10) || 600))

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    if (!policyId) return Response.json({ ok: false, error: "Missing policy_id" }, { status: 400 })

    const { data: p, error: pErr } = await supabaseAdmin
      .from("insurance_policies")
      .select("id, org_id, document_bucket, document_path, document_filename")
      .eq("id", policyId)
      .eq("org_id", orgId)
      .single()

    if (pErr) return Response.json({ ok: false, error: pErr.message }, { status: 500 })
    if (!p) return Response.json({ ok: false, error: "Not found" }, { status: 404 })

    if (!p.document_bucket || !p.document_path) {
      return Response.json({ ok: false, error: "Policy has no document uploaded yet" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from(p.document_bucket)
      .createSignedUrl(p.document_path, expiresIn)

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

    return Response.json({ ok: true, url: data?.signedUrl ?? null, filename: p.document_filename, expires_in: expiresIn })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}