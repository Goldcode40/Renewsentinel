import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function requireAdminToken(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? "";
  const expected = process.env.CONCIERGE_ADMIN_TOKEN ?? "";
  if (!expected) throw new Error("Missing CONCIERGE_ADMIN_TOKEN in env");
  return token === expected;
}

function isAdminStatus(s: string) {
  return s === "in_review" || s === "completed" || s === "rejected";
}

// POST /api/concierge/admin
// body: { request_id, status, assigned_to? }
// header: x-admin-token: <CONCIERGE_ADMIN_TOKEN>
export async function POST(req: NextRequest) {
  try {
    if (!requireAdminToken(req)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const request_id = (body?.request_id ?? "").trim();
    const status = (body?.status ?? "").trim();

    if (!request_id) return NextResponse.json({ error: "request_id required" }, { status: 400 });
    if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });
    if (!isAdminStatus(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    const assigned_to = body?.assigned_to ? String(body.assigned_to).trim() : null;

    const supabaseAdmin = getSupabaseAdmin();

    const patch: any = { status };
    if (assigned_to) patch.assigned_to = assigned_to;
    if (status === "completed") patch.completed_at = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from("concierge_requests")
      .update(patch)
      .eq("id", request_id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, request: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
