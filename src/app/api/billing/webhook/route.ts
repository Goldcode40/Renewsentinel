import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

function ok(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin()

  try {
    const sig = req.headers.get("stripe-signature")
    if (!sig) return ok({ ok: false, error: "missing stripe-signature" }, 400)

    const whsec = process.env.STRIPE_WEBHOOK_SECRET
    if (!whsec) return ok({ ok: false, error: "missing STRIPE_WEBHOOK_SECRET" }, 500)

    // IMPORTANT: Stripe needs the raw body for signature verification
    const rawBody = await req.text()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, whsec)
    } catch (e: any) {
      return ok({ ok: false, error: "signature verification failed", message: e?.message }, 400)
    }

    // 1) Idempotency: store the event once (always)
    const insertRes = await supabase
      .from("stripe_events")
      .insert({
        id: event.id,
        type: event.type,
        payload: event as any,
      })
      .select("id")

    if (insertRes.error) {
      // If already inserted, ignore. Otherwise surface error.
      const exists = await supabase.from("stripe_events").select("id").eq("id", event.id).maybeSingle()
      if (!exists.data) {
        return ok({ ok: false, where: "stripe_events insert", error: insertRes.error }, 500)
      }
      return ok({ ok: true, duplicate: true, id: event.id, type: event.type })
    }

    async function updateOrgById(orgId: string, patch: any) {
      return supabase.from("organizations").update(patch).eq("id", orgId).select("id").maybeSingle()
    }

    async function findOrgIdsByCustomer(customerId: string) {
      const res = await supabase.from("organizations").select("id").eq("stripe_customer_id", customerId)
      return res
    }

    // 2) Handle events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      const orgId = (session.metadata?.org_id || "").trim()
      const plan = (session.metadata?.plan || "").trim()
      const customerId = typeof session.customer === "string" ? session.customer : ""
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : ""

      // If no org_id metadata, we can't attribute this checkout to an org reliably.
      // We still return 200 to avoid Stripe retry loops.
      if (!orgId) {
        return ok({
          ok: true,
          note: "checkout.session.completed missing metadata.org_id; not attaching to org",
          id: event.id,
          mode: (session as any).mode,
        })
      }

      const patch: any = {
        plan: plan || "starter",
        billing_status: "active",
        stripe_customer_id: customerId || null,
        stripe_subscription_id: subscriptionId || null,
      }

      // If it was a subscription checkout, fetch subscription to capture price + period end
      if (subscriptionId) {
        const sub: any = await stripe.subscriptions.retrieve(subscriptionId)

        const priceId =
          (sub.items.data?.[0]?.price?.id as string | undefined) ||
          (sub.items.data?.[0]?.plan?.id as string | undefined)

        if (priceId) patch.stripe_price_id = priceId
        if (sub.current_period_end) patch.current_period_end = new Date(sub.current_period_end * 1000).toISOString()
      }

      const upd = await updateOrgById(orgId, patch)
      if (upd.error) return ok({ ok: false, where: "org update (checkout.session.completed)", error: upd.error }, 500)

      return ok({ ok: true, handled: event.type, org_id: orgId })
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub: any = event.data.object as Stripe.Subscription

      const customerId = typeof sub.customer === "string" ? sub.customer : ""
      const subscriptionId = sub.id

      const priceId =
        (sub.items.data?.[0]?.price?.id as string | undefined) ||
        (sub.items.data?.[0]?.plan?.id as string | undefined)

      const patch: any = {
        billing_status: sub.status === "active" ? "active" : sub.status,
        stripe_customer_id: customerId || null,
        stripe_subscription_id: subscriptionId || null,
      }
      if (priceId) patch.stripe_price_id = priceId
      if (sub.current_period_end) patch.current_period_end = new Date(sub.current_period_end * 1000).toISOString()

      if (!customerId) {
        return ok({ ok: true, handled: event.type, note: "subscription event missing customer id" })
      }

      // SAFETY: Only update when customer_id maps to exactly 1 org
      const found = await findOrgIdsByCustomer(customerId)
      if (found.error) return ok({ ok: false, where: "org lookup (stripe_customer_id)", error: found.error }, 500)

      const orgIds = (found.data || []).map((r: any) => r.id)

      if (orgIds.length === 0) {
        return ok({
          ok: true,
          handled: event.type,
          note: "no org matched stripe_customer_id; not updating",
          stripe_customer_id: customerId,
        })
      }

      if (orgIds.length > 1) {
        return ok({
          ok: true,
          handled: event.type,
          warning: "multiple orgs matched stripe_customer_id; not updating",
          stripe_customer_id: customerId,
          org_ids: orgIds,
        })
      }

      const upd = await updateOrgById(orgIds[0], patch)
      if (upd.error) return ok({ ok: false, where: "org update (subscription.*)", error: upd.error }, 500)

      return ok({ ok: true, handled: event.type, org_id: orgIds[0] })
    }

    return ok({ ok: true, ignored: event.type })
  } catch (e: any) {
    return ok({ ok: false, error: e?.message || String(e) }, 500)
  }
}


