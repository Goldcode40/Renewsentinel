import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

// Subcontractor Documents
// GET  /api/subcontractor-docs?org_id=UUID&subcontractor_id=UUID
// POST /api/subcontractor-docs   { org_id, subcontractor_id, doc_type, expires_on?, ...optional }

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const org_id = (searchParams.get("org_id") || "").trim()
    const subcontractor_id = (searchParams.get("subcontractor_id") || "").trim()

    if (!org_id || !subcontractor_id) {
      return NextResponse.json({ ok: false, error: "Missing required query params: org_id, subcontractor_id" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // HARD GATE: premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabase as any, org_id)
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: "Upgrade required", org: null }, { status: gate.status ?? 403 })
    }

    const { data, error } = await supabase
      .from("subcontractor_documents")
      .select("id,org_id,subcontractor_id,doc_type,title,expires_on,storage_bucket,storage_path,filename,content_type,size_bytes,created_at,updated_at")
      .eq("org_id", org_id)
      .eq("subcontractor_id", subcontractor_id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
    return NextResponse.json({ ok: true, rows: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null as any)
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

    const org_id = String(body?.org_id || "").trim()
    const subcontractor_id = String(body?.subcontractor_id || "").trim()
    const doc_type = String(body?.doc_type || "").trim()

    if (!org_id || !subcontractor_id || !doc_type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: org_id, subcontractor_id, doc_type" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // HARD GATE: premium-only
    const gate = await requireActiveOrTrial(supabase as any, org_id)
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: "Upgrade required", org: null }, { status: gate.status ?? 403 })
    }

    const payload = {
      org_id,
      subcontractor_id,
      doc_type,
      title: body?.title ?? null,
      expires_on: body?.expires_on ?? null,
      storage_bucket: body?.storage_bucket ?? null,
      storage_path: body?.storage_path ?? null,
      filename: body?.filename ?? null,
      content_type: body?.content_type ?? null,
      size_bytes: body?.size_bytes ?? null,
    }

    const { data, error } = await supabase
      .from("subcontractor_documents")
      .insert(payload)
      .select("id,org_id,subcontractor_id,doc_type,title,expires_on,storage_bucket,storage_path,filename,content_type,size_bytes,created_at,updated_at")
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
    return NextResponse.json({ ok: true, row: data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 })
  }
}
