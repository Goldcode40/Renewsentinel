import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireActiveOrTrial } from "@/lib/billingGate"

// Subcontractor Documents
// GET  /api/subcontractor-docs?org_id=UUID&subcontractor_id=UUID
// POST /api/subcontractor-docs   { org_id, subcontractor_id, doc_type, expires_on?, ...optional }

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

    // HARD GATE: Subcontractor Docs is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabase as any, org_id)
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required", reason: gate.reason, org: gate.org ?? null },
        { status: 403 }
      )
    }

  const subcontractor_id = (searchParams.get("subcontractor_id") || "").trim();

  if (!org_id || !subcontractor_id) {
    return NextResponse.json({ error: "Missing required query params: org_id, subcontractor_id" }, { status: 400 });
  }

  const { supabase, error: cfgErr } = getSupabase();
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("subcontractor_documents")
    .select("id,org_id,subcontractor_id,doc_type,title,expires_on,storage_bucket,storage_path,filename,content_type,size_bytes,created_at,updated_at")
    .eq("org_id", org_id)
    .eq("subcontractor_id", subcontractor_id)
    .order("created_at", { ascending: false });

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
  const subcontractor_id = (body?.subcontractor_id || "").trim();
  const doc_type = (body?.doc_type || "").trim();

  if (!org_id || !subcontractor_id || !doc_type) {
    return NextResponse.json(
      { error: "Missing required fields: org_id, subcontractor_id, doc_type" },
      { status: 400 }
    );
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
  };

  const { supabase, error: cfgErr } = getSupabase();
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("subcontractor_documents")
    .insert(payload)
    .select("id,org_id,subcontractor_id,doc_type,title,expires_on,storage_bucket,storage_path,filename,content_type,size_bytes,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ row: data });
}
