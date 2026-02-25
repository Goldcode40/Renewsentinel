import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Insurance Policies
// GET  /api/insurance?org_id=UUID
// POST /api/insurance   { org_id, provider, policy_type, expiry_date, ...optional }

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

  if (!org_id) {
    return NextResponse.json({ error: "Missing required query param: org_id" }, { status: 400 });
  }

  const { supabase, error: cfgErr } = getSupabase();
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("insurance_policies")
    .select("id,org_id,provider,policy_number,policy_type,effective_date,expiry_date,coverage_amount,document_path,notes,created_at,updated_at")
    .eq("org_id", org_id)
    .order("expiry_date", { ascending: true });

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
  const provider = (body?.provider || "").trim();
  const policy_type = (body?.policy_type || "").trim();
  const expiry_date = (body?.expiry_date || "").trim(); // YYYY-MM-DD

  if (!org_id || !provider || !policy_type || !expiry_date) {
    return NextResponse.json(
      { error: "Missing required fields: org_id, provider, policy_type, expiry_date" },
      { status: 400 }
    );
  }

  const payload = {
    org_id,
    provider,
    policy_number: body?.policy_number ?? null,
    policy_type,
    effective_date: body?.effective_date ?? null,
    expiry_date,
    coverage_amount: body?.coverage_amount ?? null,
    document_path: body?.document_path ?? null,
    notes: body?.notes ?? null,
  };

  const { supabase, error: cfgErr } = getSupabase();
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("insurance_policies")
    .insert(payload)
    .select("id,org_id,provider,policy_number,policy_type,effective_date,expiry_date,coverage_amount,document_path,notes,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ row: data });
}
