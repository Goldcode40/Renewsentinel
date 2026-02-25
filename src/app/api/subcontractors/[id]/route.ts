import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// PATCH  /api/subcontractors/:id   { org_id, ...fields }
// DELETE /api/subcontractors/:id   { org_id }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { supabase: null as any, error: "Server misconfigured: missing Supabase env vars" };
  }

  const supabase = createClient(url, anon);
  return { supabase, error: null as string | null };
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = (ctx?.params?.id || "").trim();
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

  set("name", body?.name?.trim?.() ?? body?.name);
  set("contact_name", body?.contact_name ?? null);
  set("email", body?.email ?? null);
  set("phone", body?.phone ?? null);
  set("trade", body?.trade ?? null);
  set("notes", body?.notes ?? null);
  if (typeof body?.is_active === "boolean") set("is_active", body.is_active);

  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { supabase, error: cfgErr } = getSupabase();
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { data, error } = await supabase
    .from("subcontractors")
    .update(patch)
    .eq("id", id)
    .eq("org_id", org_id)
    .select("id,org_id,name,contact_name,email,phone,trade,notes,is_active,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ row: data });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const id = (ctx?.params?.id || "").trim();
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
  if (cfgErr) return NextResponse.json({ error: cfgErr }, { status: 500 });

  const { error } = await supabase
    .from("subcontractors")
    .delete()
    .eq("id", id)
    .eq("org_id", org_id);

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}