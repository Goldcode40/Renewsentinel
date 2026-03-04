import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

// Subcontractors
// GET  /api/subcontractors?org_id=UUID
// POST /api/subcontractors   { org_id, name, ...optional }

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const org_id = (searchParams.get("org_id") || "").trim()
    if (!org_id) return NextResponse.json({ ok: false, error: "Missing required query param: org_id" }, { status: 400 })

    const supabase = getSupabaseAdmin()

    // HARD GATE: premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabase as any, org_id)
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: "Upgrade required", org: null }, { status: gate.status ?? 403 })
    }

    const { data, error } = await supabase
      .from("subcontractors")
      .select("id,org_id,name,contact_name,email,phone,trade,notes,is_active,created_at,updated_at")
      .eq("org_id", org_id)
      .order("name", { ascending: true })

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
    const name = String(body?.name || "").trim()
    if (!org_id || !name) {
      return NextResponse.json({ ok: false, error: "Missing required fields: org_id, name" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // HARD GATE: premium-only
    const gate = await requireActiveOrTrial(supabase as any, org_id)
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: "Upgrade required", org: null }, { status: gate.status ?? 403 })
    }

    const payload = {
      org_id,
      name,
      contact_name: body?.contact_name ?? null,
      email: body?.email ?? null,
      phone: body?.phone ?? null,
      trade: body?.trade ?? null,
      notes: body?.notes ?? null,
      is_active: typeof body?.is_active === "boolean" ? body.is_active : true,
    }

    const { data, error } = await supabase
      .from("subcontractors")
      .insert(payload)
      .select("id,org_id,name,contact_name,email,phone,trade,notes,is_active,created_at,updated_at")
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
    return NextResponse.json({ ok: true, row: data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 })
  }
}
