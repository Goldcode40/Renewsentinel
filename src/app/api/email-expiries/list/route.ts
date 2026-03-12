import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveOrTrial } from "@/lib/billingGate";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id") || "";
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") || "20", 10)));

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const gate = await requireActiveOrTrial(supabase as any, orgId);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("email_expiries")
      .select("id, org_id, gmail_message_id, subject, from_email, gmail_date_header, parsed_expiry_date, matched_item_id, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      org_id: orgId,
      count: data?.length ?? 0,
      items: data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

