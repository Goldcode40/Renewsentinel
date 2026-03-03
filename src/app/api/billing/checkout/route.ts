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
    const priceStarter = requireEnv("NEXT_PUBLIC_STRIPE_PRICE_STARTER")
    const pricePro = requireEnv("NEXT_PUBLIC_STRIPE_PRICE_PRO")

    const body = await req.json().catch(() => ({}))
    const org_id = String(body.org_id || "").trim()
    const plan = String(body.plan || "starter").toLowerCase()

    if (!org_id) {
      return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    }
    if (!["starter", "pro"].includes(plan)) {
      return NextResponse.json({ ok: false, error: "Invalid plan. Use starter|pro" }, { status: 400 })
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" })
    const supabase = getSupabaseAdmin()

    // Load org billing state
    const orgRes = await supabase
      .from("organizations")
      .select("id, plan, billing_status, stripe_customer_id, stripe_subscription_id")
      .eq("id", org_id)
      .maybeSingle()

    if (orgRes.error) {
      return NextResponse.json({ ok: false, where: "supabase org select", error: orgRes.error }, { status: 500 })
    }

    const billingStatus = String(orgRes.data?.billing_status || "").trim()
    const existingCustomerId = String(orgRes.data?.stripe_customer_id || "").trim()
    const existingSubId = String(orgRes.data?.stripe_subscription_id || "").trim()

    // ✅ Guard: if already active, return a Billing Portal link instead of making a new subscription
    if (billingStatus === "active" && existingSubId && existingCustomerId) {
      const return_url = "http://localhost:3000/dashboard-premium?billing=portal_return"
      const portal = await stripe.billingPortal.sessions.create({
        customer: existingCustomerId,
        return_url,
      })

      return NextResponse.json(
        {
          ok: false,
          error: "Org already has an active subscription",
          org_id,
          stripe_customer_id: existingCustomerId,
          stripe_subscription_id: existingSubId,
          portal_url: portal.url,
        },
        { status: 409 }
      )
    }

    const price = plan === "pro" ? pricePro : priceStarter

    const success_url = "http://localhost:3000/dashboard-premium?billing=success"
    const cancel_url = "http://localhost:3000/dashboard-premium?billing=cancel"

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url,
      cancel_url,

      // If we already have a customer on the org, reuse it (prevents extra Stripe customers)
      ...(existingCustomerId ? { customer: existingCustomerId } : {}),

      // 🔑 Lets webhook map Stripe -> your org
      metadata: { org_id, plan },
    })

    return NextResponse.json({ ok: true, url: session.url, id: session.id })
  } catch (e: any) {
    console.error("billing/checkout error:", e?.message || e)
    return NextResponse.json(
      { ok: false, where: "billing/checkout", error: String(e?.message || e) },
      { status: 500 }
    )
  }
}
