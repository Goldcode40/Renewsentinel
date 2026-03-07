import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({} as any))
    const org_id = String(body.org_id || "").trim()
    if (!org_id) return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    const patch = {
      plan: "free",
      billing_status: "inactive",
      trial_ends_at: null,
      current_period_end: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
    }

    const upd = await supabase
      .from("organizations")
      .update(patch)
      .eq("id", org_id)
      .select("id,name,plan,billing_status,trial_ends_at,current_period_end,stripe_customer_id,stripe_subscription_id,stripe_price_id")
      .maybeSingle()

    if (upd.error) {
      return NextResponse.json({ ok: false, where: "org reset update", error: upd.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, org: upd.data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
