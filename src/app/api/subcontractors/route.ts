import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireActiveOrTrial } from "@/lib/billingGate"

// Subcontractors
// GET  /api/subcontractors?org_id=UUID
// POST /api/subcontractors   { org_id, name, ...optional }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { supabase: null as any, error: "Server misconfigured: missing Supabase env vars" };
  }

  const supabase = createClient(url, anon);
  return { supabase, error: null as string | null };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const org_id = (searchParams.get("org_id") || "").trim();

    // HARD GATE: Subcontractors is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabase as any, org_id)
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required", reason: gate.reason, org: gate.org ?? null },
        { status: 403 }
      )
    }


  if (!org_id) {
    return NextResponse.json({ error: "Missing required query param: org_id" }, { status: 400 });
  }

  const { supabase, error: cfgErr } = getSupabase();
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("subcontractors")
    .select("id,org_id,name,contact_name,email,phone,trade,notes,is_active,created_at,updated_at")
    .eq("org_id", org_id)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  let body: any = null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const org_id = (body?.org_id || "").trim();
  const name = (body?.name || "").trim();

  if (!org_id || !name) {
    return NextResponse.json({ error: "Missing required fields: org_id, name" }, { status: 400 });
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
  };

  const { supabase, error: cfgErr } = getSupabase();
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("subcontractors")
    .insert(payload)
    .select("id,org_id,name,contact_name,email,phone,trade,notes,is_active,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ row: data });
}
