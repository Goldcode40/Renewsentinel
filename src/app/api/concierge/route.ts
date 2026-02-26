import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/concierge?org_id=...
export async function GET(req: NextRequest) {
  try {
    const org_id = req.nextUrl.searchParams.get("org_id");
    if (!org_id) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const supabase = sb();

    const { data: request, error: reqErr } = await supabase
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

    const { data: documents, error: docErr } = await supabase
      .from("concierge_documents")
      .select("*")
      .eq("request_id", request.id)
      .order("created_at", { ascending: false });

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

    return NextResponse.json({ request, documents: documents ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}

// POST /api/concierge
// body: { org_id, profile_state?, profile_trade?, notes?, status? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const org_id = body?.org_id;
    if (!org_id) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const status = body?.status ?? "submitted";

    const supabase = sb();

    // Upsert-ish: if existing latest request exists and is not completed, update it; else create new.
    const { data: existing, error: exErr } = await supabase
      .from("concierge_requests")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

    if (existing && existing.status !== "completed") {
      const { data: updated, error: upErr } = await supabase
        .from("concierge_requests")
        .update({
          status,
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

    const { data: created, error: crErr } = await supabase
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
