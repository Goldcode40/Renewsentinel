import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function isPlaceholder(val?: string) {
  if (!val) return true
  return val.includes("REPLACE_ME") || val.includes("YOUR_REAL_KEY")
}

export async function GET() {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    const priceStarter = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER
    const pricePro = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO

    const envCheck = {
      STRIPE_SECRET_KEY: stripeSecret ? (isPlaceholder(stripeSecret) ? "placeholder" : "set") : "missing",
      STRIPE_WEBHOOK_SECRET: webhookSecret ? (isPlaceholder(webhookSecret) ? "placeholder" : "set") : "missing",
      NEXT_PUBLIC_STRIPE_PRICE_STARTER: priceStarter ? "set" : "missing",
      NEXT_PUBLIC_STRIPE_PRICE_PRO: pricePro ? "set" : "missing",
    }

    const supa = getSupabaseAdmin()

    // 1) Can we reach DB?
    const ping = await supa.from("organizations").select("id").limit(1)
    if (ping.error) {
      return NextResponse.json(
        { ok: false, where: "supabase organizations select", envCheck, error: ping.error },
        { status: 500 }
      )
    }

    // 2) Can we write stripe_events?
    const testId = `diag_${Date.now()}`
    const ins = await supa.from("stripe_events").insert({
      id: testId,
      type: "diag.test",
      payload: { ok: true, at: new Date().toISOString() } as any,
    })

    if (ins.error) {
      return NextResponse.json(
        { ok: false, where: "supabase stripe_events insert", envCheck, error: ins.error },
        { status: 500 }
      )
    }

    // 3) Verify it exists
    const readBack = await supa.from("stripe_events").select("id,type,created").eq("id", testId).maybeSingle()
    if (readBack.error) {
      return NextResponse.json(
        { ok: false, where: "supabase stripe_events readback", envCheck, error: readBack.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, envCheck, db: { orgs_sample: ping.data?.[0] ?? null }, stripe_events_test: readBack.data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, where: "fatal", error: e?.message ?? String(e) }, { status: 500 })
  }
}
