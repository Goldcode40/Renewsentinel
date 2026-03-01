import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  org_id: string;
  email_expiry_id: string;
  compliance_item_id: string;
  confidence?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.org_id || !body?.email_expiry_id || !body?.compliance_item_id) {
      return NextResponse.json(
        { error: "Missing org_id, email_expiry_id, or compliance_item_id" },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Upsert link (unique should be org_id + email_expiry_id + compliance_item_id if you add it later;
    // for now we do insert + ignore conflict by checking first)
    const existing = await sb
      .from("email_expiry_item_links")
      .select("id")
      .eq("org_id", body.org_id)
      .eq("email_expiry_id", body.email_expiry_id)
      .eq("compliance_item_id", body.compliance_item_id)
      .maybeSingle();

    if (existing.data?.id) {
      // touch row to fire trigger if needed
      const upd = await sb
        .from("email_expiry_item_links")
        .update({ confidence: body.confidence ?? 80 })
        .eq("id", existing.data.id)
        .select("id")
        .single();

      if (upd.error) throw upd.error;

      return NextResponse.json({ ok: true, link_id: upd.data.id, mode: "updated" });
    }

    const ins = await sb
      .from("email_expiry_item_links")
      .insert({
        org_id: body.org_id,
        email_expiry_id: body.email_expiry_id,
        compliance_item_id: body.compliance_item_id,
        confidence: body.confidence ?? 80,
      })
      .select("id")
      .single();

    if (ins.error) throw ins.error;

    // Trigger is AFTER INSERT on email_expiry_item_links, so expires_on updates automatically.
    return NextResponse.json({ ok: true, link_id: ins.data.id, mode: "inserted" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
