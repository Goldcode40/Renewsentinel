import { getSupabaseAdmin } from "@/lib/supabaseAdmin"


import { requireActiveOrTrial } from "@/lib/billingGate"
export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    async function signedUrl(bucket: string | null, path: string | null, expiresIn = 600) {
      try {
        if (!bucket || !path) return null
        const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn)
        if (error) return null
        return data?.signedUrl ?? null
      } catch {
        return null
      }
    }

    const url = new URL(req.url)
    const orgId = (url.searchParams.get("org_id") ?? "").trim()

    if (!orgId) {
  return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
}

// HARD GATE: Proof Pack is premium-only (active subscription OR active trial)
const gate = await requireActiveOrTrial(supabaseAdmin as any, orgId)
if (!gate.ok) {
  return Response.json(
    { ok: false, error: "Upgrade required" },
    { status: 403 }
  )
}
// org
    const orgRes = await supabaseAdmin
      .from("organizations")
      .select("id, name, created_at, profile_state, profile_trade")
      .eq("id", orgId)
      .maybeSingle()

    if (orgRes.error) return Response.json({ ok: false, error: orgRes.error.message }, { status: 500 })
    if (!orgRes.data) return Response.json({ ok: false, error: "Org not found" }, { status: 404 })
    // items
    const itemsRes = await supabaseAdmin
      .from("compliance_items")
      .select("id, org_id, type, title, issuer, identifier, expires_on, renewal_window_days, status, created_at, updated_at")
      .eq("org_id", orgId)
      .order("expires_on", { ascending: true })

    if (itemsRes.error) return Response.json({ ok: false, error: itemsRes.error.message }, { status: 500 })

    const items = itemsRes.data ?? []
    const itemIds = items.map((i) => i.id)

    // insurance policies
    const insRes = await supabaseAdmin
      .from("insurance_policies")
      .select("id, org_id, provider, policy_number, policy_type, effective_date, expiry_date, coverage_amount, document_path, notes, created_at, updated_at, document_bucket, document_filename, document_content_type, document_size_bytes")
      .eq("org_id", orgId)
      .order("expiry_date", { ascending: true })

    if (insRes.error) return Response.json({ ok: false, error: insRes.error.message }, { status: 500 })
    const insurance_policies = insRes.data ?? []

    // subcontractors
    const subsRes = await supabaseAdmin
      .from("subcontractors")
      .select("id, org_id, name, contact_name, email, phone, trade, notes, is_active, created_at, updated_at")
      .eq("org_id", orgId)
      .order("name", { ascending: true })

    if (subsRes.error) return Response.json({ ok: false, error: subsRes.error.message }, { status: 500 })
    let subcontractors = subsRes.data ?? []
    const subIds = subcontractors.map((s) => s.id)

    // normalized subcontractor docs array used by the pack builder
    // subcontractor docs
    let subcontractor_documents: any[] = []
    if (subIds.length > 0) {
      const docsRes = await supabaseAdmin
        .from("subcontractor_documents")
        .select("id, org_id, subcontractor_id, doc_type, title, expires_on, filename, content_type, size_bytes, storage_bucket, storage_path, created_at, updated_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })

      if (docsRes.error) return Response.json({ ok: false, error: docsRes.error.message }, { status: 500 })
      subcontractor_documents = docsRes.data ?? []
    }


    // normalize docs array for pack builder
    const subDocs = subcontractor_documents ?? []

    // latest doc per compliance item (best-effort)
    const latestDocsByItem: Record<string, any> = {}
    const latestDocUrlByItem: Record<string, string | null> = {}

    if (itemIds.length > 0) {
      const docsRes = await supabaseAdmin
        .from("item_documents")
        .select("id, org_id, item_id, filename, content_type, size_bytes, storage_bucket, storage_path, created_at")
        .eq("org_id", orgId)
        .in("item_id", itemIds)
        .order("created_at", { ascending: false })

      if (docsRes.error) return Response.json({ ok: false, error: docsRes.error.message }, { status: 500 })

      for (const d of docsRes.data ?? []) {
        if (!latestDocsByItem[d.item_id]) latestDocsByItem[d.item_id] = d
      }
    }

    // signed URLs for compliance item docs
    const expiresIn = 600
    for (const itemId of Object.keys(latestDocsByItem)) {
      const doc = latestDocsByItem[itemId]
      if (!doc?.storage_bucket || !doc?.storage_path) {
        latestDocUrlByItem[itemId] = null
        continue
      }

      const { data, error } = await supabaseAdmin.storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.storage_path, expiresIn)

      if (error) {
        latestDocUrlByItem[itemId] = null
        continue
      }

      latestDocUrlByItem[itemId] = data?.signedUrl ?? null
    }

    

const pack = {
      generated_at: new Date().toISOString(),
      org: orgRes.data,
      summary: {
        total_items: items.length,
        items_with_latest_doc: Object.keys(latestDocsByItem).length,
        total_insurance_policies: insurance_policies.length,
        total_subcontractors: subcontractors.length,
        total_subcontractor_documents: subDocs.length,
      },
      insurance_policies: await Promise.all(
        (insurance_policies ?? []).map(async (p: any) => ({
          ...p,
          document_signed_url: await signedUrl(p.document_bucket ?? null, p.document_path ?? null, 600),
        }))
      ),
      subcontractors: subcontractors ?? [],
      subcontractor_documents: await Promise.all(
        (subDocs ?? []).map(async (d: any) => ({
          ...d,
          signed_url: await signedUrl(d.storage_bucket ?? null, d.storage_path ?? null, 600),
        }))
      ),
      items: items.map((i) => ({
        ...i,
        latest_doc: latestDocsByItem[i.id] ?? null,
        latest_doc_signed_url: latestDocUrlByItem[i.id] ?? null,
      })),
    }

    // Audit log - best effort
    try {
      await supabaseAdmin.from("audit_log_events").insert({
        org_id: orgId,
        actor_user_id: "00000000-0000-0000-0000-000000000001",
        actor_role: "owner",
        action: "proofpack.exported.json",
        entity_type: "proof_pack",
        entity_id: null,
        details: pack.summary,
      })
    } catch (_) {}

    return Response.json({ ok: true, pack })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}



