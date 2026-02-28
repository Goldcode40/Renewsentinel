import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type MemberRole = "owner" | "admin" | "member";

async function requireOrgAdmin(supabaseAdmin: any, org_id: string, user_id: string) {
  const { data, error } = await supabaseAdmin
    .from("org_members")
    .select("role")
    .eq("org_id", org_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.role) return { ok: false as const, role: null };

  const role = data.role as MemberRole;
  const ok = role === "owner" || role === "admin";
  return { ok, role };
}

function pickUserAllowedStatus(input: any) {
  // Users can only submit (or remain not_started if you ever support draft).
  const s = (typeof input === "string" ? input : "").trim();
  if (!s) return "submitted";
  if (s === "submitted" || s === "not_started") return s;
  return "submitted";
}

// GET /api/concierge?org_id=...&user_id=...
export async function GET(req: NextRequest) {
  try {
    const org_id = (req.nextUrl.searchParams.get("org_id") ?? "").trim();
    const user_id = (req.nextUrl.searchParams.get("user_id") ?? "").trim();

    if (!org_id) return NextResponse.json({ error: "org_id required" }, { status: 400 });
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const supabaseAdmin = getSupabaseAdmin();

    const authz = await requireOrgAdmin(supabaseAdmin, org_id, user_id);
    if (!authz.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: request, error: reqErr } = await supabaseAdmin
      .from("concierge_requests")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    if (!request) {
      return NextResponse.json({ request: null, documents: [] }, { status: 200 });
    }

    const { data: documents, error: docErr } = await supabaseAdmin
      .from("concierge_documents")
      .select("*")
      .eq("request_id", request.id)
      .order("created_at", { ascending: false });

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

    return NextResponse.json(
      { request, documents: documents ?? [], viewer_role: authz.role },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}

// POST /api/concierge
// body: { org_id, user_id, profile_state?, profile_trade?, notes?, status? }
// Users cannot set in_review/completed/rejected. They can only submit intake.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const org_id = (body?.org_id ?? "").trim();
    const user_id = (body?.user_id ?? "").trim();

    if (!org_id) return NextResponse.json({ error: "org_id required" }, { status: 400 });
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const supabaseAdmin = getSupabaseAdmin();

    const authz = await requireOrgAdmin(supabaseAdmin, org_id, user_id);
    if (!authz.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const status = pickUserAllowedStatus(body?.status);

    // Upsert-ish: if existing latest request exists and is not completed/rejected, update it; else create new.
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("concierge_requests")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    const existingStatus = (existing?.status ?? "") as string;
    const isClosed = existingStatus === "completed" || existingStatus === "rejected";

    if (existing && !isClosed) {
      const { data: updated, error: upErr } = await supabaseAdmin
        .from("concierge_requests")
        .update({
          status, // will be submitted/not_started only
          profile_state: body?.profile_state ?? existing.profile_state,
          profile_trade: body?.profile_trade ?? existing.profile_trade,
          notes: body?.notes ?? existing.notes,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({ request: updated }, { status: 200 });
    }

    const { data: created, error: crErr } = await supabaseAdmin
      .from("concierge_requests")
      .insert({
        org_id,
        status,
        profile_state: body?.profile_state ?? null,
        profile_trade: body?.profile_trade ?? null,
        notes: body?.notes ?? null,
      })
      .select("*")
      .single();

    if (crErr) return NextResponse.json({ error: crErr.message }, { status: 500 });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
