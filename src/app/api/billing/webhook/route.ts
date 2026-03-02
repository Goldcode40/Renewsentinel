import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  // apiVersion is optional; leaving it out avoids TS type mismatch issues across Stripe versions
})

// Supabase service client (bypasses RLS)
function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

  if (!url || !key) throw new Error("Missing SUPABASE URL or SERVICE ROLE KEY")

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function recordEvent(sb: ReturnType<typeof supabaseAdmin>, evt: Stripe.Event, extra: any) {
  // Best-effort insert. If it fails, we still continue (webhook should not die on logging).
  try {
    const payload = {
      id: evt.id,
      type: evt.type,
      created: new Date((evt.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      raw_event: evt as any,
      ...extra,
    }

    // If you've got a UNIQUE PK on id, this avoids duplicate crashes
    // (insert will fail if exists; we ignore)
    await sb.from("stripe_events").insert(payload)
  } catch {
    // swallow
  }
}

export async function POST(req: Request) {
  const whsec = process.env.STRIPE_WEBHOOK_SECRET
  if (!whsec) {
    return NextResponse.json({ ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 })
  }

  // Read raw body for signature verification
  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ ok: false, error: "Missing Stripe-Signature header" }, { status: 400 })
  }

  const raw = Buffer.from(await req.arrayBuffer())

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whsec)
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Signature verification failed", detail: err?.message ?? String(err) },
      { status: 400 }
    )
  }

  const sb = supabaseAdmin()

  // Default: log everything, but only act on what we care about
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      const orgId = (session.metadata?.org_id ?? "") as string
      const plan = (session.metadata?.plan ?? "") as string

      const customerId = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null)
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null)

      const paymentStatus = (session.payment_status ?? null) as any
      const sessionId = session.id

      // Record event first
      await recordEvent(sb, event, {
        session_id: sessionId,
        meta_org_id: orgId || null,
        meta_plan: plan || null,
        customer_id: customerId,
        subscription_id: subscriptionId,
        payment_status: paymentStatus,
      })

      // If metadata is missing, we can't tie to an org — don't 500, just ack.
      if (!orgId) {
        return NextResponse.json({ ok: true, note: "No org_id in metadata; logged only" })
      }

      // If this was a subscription checkout, pull canonical values from Stripe
      let stripePriceId: string | null = null
      let periodEndIso: string | null = null
      let trialEndIso: string | null = null
      let billingStatus: string | null = null

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId)

        stripePriceId = sub.items?.data?.[0]?.price?.id ?? null
        periodEndIso = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
        trialEndIso = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
        billingStatus = sub.status ?? null
      } else {
        // One-time payment checkout: treat as paid but no subscription
        billingStatus = paymentStatus === "paid" ? "active" : "inactive"
      }

      const update: any = {
        billing_status: billingStatus === "active" ? "active" : (billingStatus ?? "active"),
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      }

      if (plan) update.plan = plan
      if (stripePriceId) update.stripe_price_id = stripePriceId
      if (periodEndIso) update.current_period_end = periodEndIso
      if (trialEndIso) update.trial_ends_at = trialEndIso

      const { error } = await sb
        .from("organizations")
        .update(update)
        .eq("id", orgId)

      if (error) {
        // Return 200 so Stripe doesn't retry forever, but include details for your logs
        return NextResponse.json({ ok: true, updated: false, orgId, error }, { status: 200 })
      }

      return NextResponse.json({ ok: true, updated: true, orgId, subscriptionId, stripePriceId })
    }

    // For all other event types, just log and ack
    await recordEvent(sb, event, {})
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // Ack with 200 to avoid Stripe retry storms, but give you the error in response/log
    return NextResponse.json(
      { ok: true, note: "handler error (acked)", error: err?.message ?? String(err), type: event.type },
      { status: 200 }
    )
  }
}
