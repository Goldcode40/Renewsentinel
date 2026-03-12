import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireActiveOrTrial } from "@/lib/billingGate";

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

    // HARD GATE: Email Expiries Link Item is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(sb as any, body.org_id);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      );
    }

    // Validate that the email expiry belongs to this org
    const emailExpiryRes = await sb
      .from("email_expiries")
      .select("id, org_id, parsed_expiry_date")
      .eq("id", body.email_expiry_id)
      .eq("org_id", body.org_id)
      .maybeSingle();

    if (emailExpiryRes.error) {
      throw emailExpiryRes.error;
    }

    if (!emailExpiryRes.data) {
      return NextResponse.json(
        { ok: false, error: "Email expiry record not found for this organization" },
        { status: 404 }
      );
    }

    // Validate that the compliance item belongs to this org
    const itemRes = await sb
      .from("compliance_items")
      .select("id, org_id, title, expires_on")
      .eq("id", body.compliance_item_id)
      .eq("org_id", body.org_id)
      .maybeSingle();

    if (itemRes.error) {
      throw itemRes.error;
    }

    if (!itemRes.data) {
      return NextResponse.json(
        { ok: false, error: "Compliance item not found for this organization" },
        { status: 404 }
      );
    }

    // Upsert link (unique is org_id + email_expiry_id + compliance_item_id)
    const existing = await sb
      .from("email_expiry_item_links")
      .select("id")
      .eq("org_id", body.org_id)
      .eq("email_expiry_id", body.email_expiry_id)
      .eq("compliance_item_id", body.compliance_item_id)
      .maybeSingle();

    if (existing.error) {
      throw existing.error;
    }

    if (existing.data?.id) {
      const upd = await sb
        .from("email_expiry_item_links")
        .update({ confidence: body.confidence ?? 80 })
        .eq("id", existing.data.id)
        .select("id, confidence")
        .single();

      if (upd.error) {
        throw upd.error;
      }

      return NextResponse.json({
        ok: true,
        link_id: upd.data.id,
        mode: "updated",
        org_id: body.org_id,
        email_expiry_id: body.email_expiry_id,
        compliance_item_id: body.compliance_item_id,
        parsed_expiry_date: emailExpiryRes.data.parsed_expiry_date ?? null,
        confidence: upd.data.confidence,
      });
    }

    const ins = await sb
      .from("email_expiry_item_links")
      .insert({
        org_id: body.org_id,
        email_expiry_id: body.email_expiry_id,
        compliance_item_id: body.compliance_item_id,
        confidence: body.confidence ?? 80,
      })
      .select("id, confidence")
      .single();

    if (ins.error) {
      throw ins.error;
    }

    // Trigger is AFTER INSERT on email_expiry_item_links, so expires_on updates automatically.
    return NextResponse.json({
      ok: true,
      link_id: ins.data.id,
      mode: "inserted",
      org_id: body.org_id,
      email_expiry_id: body.email_expiry_id,
      compliance_item_id: body.compliance_item_id,
      parsed_expiry_date: emailExpiryRes.data.parsed_expiry_date ?? null,
      confidence: ins.data.confidence,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

