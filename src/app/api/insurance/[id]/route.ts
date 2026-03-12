import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireActiveOrTrial } from "@/lib/billingGate";

// PATCH  /api/insurance/:id   { org_id, ...fields }
// DELETE /api/insurance/:id   { org_id }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { supabase: null as any, error: "Server misconfigured: missing Supabase env vars" };
  }

  const supabase = createClient(url, anon);
  return { supabase, error: null as string | null };
}

type Ctx = { params: Promise<{ id: string }> };

async function getId(ctx: Ctx) {
  const p = await ctx.params;
  return (p?.id || "").trim();
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const id = await getId(ctx);
  if (!id) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const org_id = (body?.org_id || "").trim();
  if (!org_id) return NextResponse.json({ error: "Missing required field: org_id" }, { status: 400 });

  const patch: any = {};
  const set = (k: string, v: any) => { if (v !== undefined) patch[k] = v; };

  set("provider", body?.provider?.trim?.() ?? body?.provider);
  set("policy_type", body?.policy_type?.trim?.() ?? body?.policy_type);
  set("policy_number", body?.policy_number ?? null);
  set("effective_date", body?.effective_date ?? null);
  set("expiry_date", body?.expiry_date);
  set("coverage_amount", body?.coverage_amount ?? null);
  set("document_path", body?.document_path ?? null);
  set("notes", body?.notes ?? null);

  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { supabase, error: cfgErr } = getSupabase();

  // HARD GATE: Insurance By ID PATCH is premium-only (active subscription OR active trial)
  const gate = await requireActiveOrTrial(supabase as any, org_id);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required" },
      { status: 403 }
    );
  }

  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("insurance_policies")
    .update(patch)
    .eq("id", id)
    .eq("org_id", org_id)
    .select("id,org_id,provider,policy_number,policy_type,effective_date,expiry_date,coverage_amount,document_path,notes,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ row: data });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const id = await getId(ctx);
  if (!id) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const org_id = (body?.org_id || "").trim();
  if (!org_id) return NextResponse.json({ error: "Missing required field: org_id" }, { status: 400 });

  const { supabase, error: cfgErr } = getSupabase();

  // HARD GATE: Insurance By ID DELETE is premium-only (active subscription OR active trial)
  const gate = await requireActiveOrTrial(supabase as any, org_id);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required" },
      { status: 403 }
    );
  }

  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { error } = await supabase
    .from("insurance_policies")
    .delete()
    .eq("id", id)
    .eq("org_id", org_id);

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

