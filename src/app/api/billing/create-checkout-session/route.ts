import { NextResponse } from "next/server"
import Stripe from "stripe"

function isPlaceholder(val?: string) {
  if (!val) return true
  return val.includes("REPLACE_ME")
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const org_id = body?.org_id as string | undefined
    const plan = (body?.plan as string | undefined)?.toLowerCase()

    if (!org_id) {
      return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 })
    }
    if (!plan || !["starter", "pro"].includes(plan)) {
      return NextResponse.json({ ok: false, error: "plan must be 'starter' or 'pro'" }, { status: 400 })
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    const priceStarter = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER
    const pricePro = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO

    if (isPlaceholder(secretKey)) {
      return NextResponse.json(
        { ok: false, error: "Stripe is not configured: STRIPE_SECRET_KEY is missing/placeholder" },
        { status: 500 }
      )
    }

    const priceId =
      plan === "starter" ? priceStarter :
      plan === "pro" ? pricePro :
      undefined

    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: `Stripe is not configured: missing price id for plan '${plan}'` },
        { status: 500 }
      )
    }

    // NOTE: set these to your real domains later (or pass in from the client)
    const origin = new URL(req.url).origin
    const successUrl = `${origin}/dashboard-premium?billing=success`
    const cancelUrl = `${origin}/dashboard-premium?billing=cancel`

    const stripe = new Stripe(secretKey)

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          org_id,
          plan,
        },
      },
      metadata: {
        org_id,
        plan,
      },
    })

    return NextResponse.json({ ok: true, url: session.url, id: session.id })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
