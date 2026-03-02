import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function mustEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

// Helps when Supabase returns duplicate key errors in different formats
function isDuplicateError(err: any) {
  const msg = String(err?.message ?? err ?? "").toLowerCase()
  const code = String(err?.code ?? "").toLowerCase()
  return msg.includes("duplicate") || msg.includes("already exists") || code === "23505"
}

export async function POST(req: Request) {
  try {
    const secretKey = mustEnv("STRIPE_SECRET_KEY")
    const webhookSecret = mustEnv("STRIPE_WEBHOOK_SECRET")

    const stripe = new Stripe(secretKey)

    const sig = req.headers.get("stripe-signature")
    if (!sig) {
      return NextResponse.json({ ok: false, error: "Missing stripe-signature header" }, { status: 400 })
    }

    const rawBody = await req.text()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err: any) {
      console.error("[billing/webhook] signature verification failed", err)
      return NextResponse.json(
        { ok: false, error: `Webhook signature verification failed: ${err?.message ?? String(err)}` },
        { status: 400 }
      )
    }

    const supa = getSupabaseAdmin()

    // 1) Idempotency: store event (ignore duplicates)
    const ins = await supa.from("stripe_events").insert({
      id: event.id,
      type: event.type,
      payload: event as any,
    })

    if (ins.error && !isDuplicateError(ins.error)) {
      console.error("[billing/webhook] stripe_events insert failed", ins.error)
      return NextResponse.json({ ok: false, error: `stripe_events insert failed: ${ins.error.message}` }, { status: 500 })
    }

    // 2) Apply effects for key events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const org_id = (session.metadata?.org_id || "") as string
      const plan = (session.metadata?.plan || "") as string

      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id

      if (org_id && plan) {
        const upd = await supa
          .from("organizations")
          .update({
            plan,
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: subscriptionId ?? null,
            billing_status: "active",
          })
          .eq("id", org_id)

        if (upd.error) {
          console.error("[billing/webhook] organizations update failed (checkout.session.completed)", upd.error)
          return NextResponse.json({ ok: false, error: `organizations update failed: ${upd.error.message}` }, { status: 500 })
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id
      const subscriptionId = sub.id
      const priceId = sub.items?.data?.[0]?.price?.id ?? null

      const status = sub.status
      const billing_status =
        status === "active" || status === "trialing" ? "active" :
        status === "canceled" ? "canceled" :
        status === "past_due" ? "past_due" :
        status === "unpaid" ? "unpaid" :
        status

      const maybePlan =
        event.type === "customer.subscription.deleted" || status === "canceled" ? "free" : null

      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null

      let q = supa.from("organizations").update({
        stripe_customer_id: customerId ?? null,
        stripe_subscription_id: subscriptionId ?? null,
        stripe_price_id: priceId,
        billing_status,
        current_period_end: periodEnd,
        trial_ends_at: trialEnd,
        ...(maybePlan ? { plan: maybePlan } : {}),
      })

      if (subscriptionId) q = q.eq("stripe_subscription_id", subscriptionId)
      else if (customerId) q = q.eq("stripe_customer_id", customerId)
      else q = q.eq("id", "__no_match__")

      const upd = await q
      if (upd.error) {
        console.error("[billing/webhook] organizations update failed (subscription event)", upd.error)
        return NextResponse.json({ ok: false, error: `organizations update failed: ${upd.error.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, received: true, type: event.type, id: event.id })
  } catch (e: any) {
    console.error("[billing/webhook] fatal error", e)
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 })
  }
}
