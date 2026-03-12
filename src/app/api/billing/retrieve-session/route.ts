import { NextResponse } from "next/server"
import Stripe from "stripe"

function isPlaceholder(val?: string) {
  if (!val) return true
  return val.includes("REPLACE_ME")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const session_id = searchParams.get("session_id") || ""

    if (!session_id) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 })
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (isPlaceholder(secretKey)) {
      return NextResponse.json(
        { ok: false, error: "Stripe is not configured: STRIPE_SECRET_KEY is missing/placeholder" },
        { status: 500 }
      )
    }

    const stripe = new Stripe(secretKey as string)
    const s = await stripe.checkout.sessions.retrieve(session_id)

    return NextResponse.json({
      ok: true,
      id: s.id,
      status: s.status,
      mode: s.mode,
      url: s.url,
      payment_status: s.payment_status,
      customer: s.customer,
      subscription: s.subscription,
      metadata: s.metadata,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}

