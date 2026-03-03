import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export async function POST(req: Request) {
  try {
    const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY")
    const body = await req.json().catch(() => ({}))
    const org_id = String(body.org_id || "").trim()

    if (!org_id) {
      return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const orgRes = await supabase
      .from("organizations")
      .select("id, stripe_customer_id")
      .eq("id", org_id)
      .maybeSingle()

    if (orgRes.error) {
      return NextResponse.json({ ok: false, where: "supabase org select", error: orgRes.error }, { status: 500 })
    }

    const customerId = (orgRes.data?.stripe_customer_id || "").trim()
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Org has no stripe_customer_id yet" }, { status: 400 })
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" })

    // Where Stripe should send them back after managing billing
    const return_url = "http://localhost:3000/dashboard-premium?billing=portal_return"

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    })

    return NextResponse.json({ ok: true, url: portal.url })
  } catch (e: any) {
    console.error("billing/portal error:", e?.message || e)
    return NextResponse.json(
      { ok: false, where: "billing/portal", error: String(e?.message || e) },
      { status: 500 }
    )
  }
}
