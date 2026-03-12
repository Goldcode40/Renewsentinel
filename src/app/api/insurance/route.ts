import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const orgId = (searchParams.get("org_id") ?? "").trim()

    if (!orgId) {
      return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    }

    // HARD GATE: Insurance is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabaseAdmin as any, orgId)
    if (!gate.ok) {
      return Response.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("insurance_policies")
      .select("id,org_id,provider,policy_number,policy_type,effective_date,expiry_date,coverage_amount,document_path,notes,created_at,updated_at,document_bucket,document_filename,document_content_type,document_size_bytes")
      .eq("org_id", orgId)
      .order("expiry_date", { ascending: true })

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

    return Response.json({ ok: true, rows: data ?? [] })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await req.json().catch(() => null)

    const orgId = String(body?.org_id ?? "").trim()
    const provider = String(body?.provider ?? "").trim()
    const policyType = String(body?.policy_type ?? "").trim()
    const expiryDate = String(body?.expiry_date ?? "").trim() // YYYY-MM-DD

    if (!orgId || !provider || !policyType || !expiryDate) {
      return Response.json(
        { ok: false, error: "Missing required fields: org_id, provider, policy_type, expiry_date" },
        { status: 400 }
      )
    }

    // HARD GATE: Insurance is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabaseAdmin as any, orgId)
    if (!gate.ok) {
      return Response.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      )
    }

    const payload = {
      org_id: orgId,
      provider,
      policy_number: body?.policy_number ?? null,
      policy_type: policyType,
      effective_date: body?.effective_date ?? null,
      expiry_date: expiryDate,
      coverage_amount: body?.coverage_amount ?? null,
      document_path: body?.document_path ?? null,
      notes: body?.notes ?? null,
      document_bucket: body?.document_bucket ?? null,
      document_filename: body?.document_filename ?? null,
      document_content_type: body?.document_content_type ?? null,
      document_size_bytes: body?.document_size_bytes ?? null,
    }

    const { data, error } = await supabaseAdmin
      .from("insurance_policies")
      .insert(payload)
      .select("id,org_id,provider,policy_number,policy_type,effective_date,expiry_date,coverage_amount,document_path,notes,created_at,updated_at,document_bucket,document_filename,document_content_type,document_size_bytes")
      .single()

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

    return Response.json({ ok: true, row: data })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}


