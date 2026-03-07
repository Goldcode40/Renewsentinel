import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const org_id = String(body.org_id || "").trim()
    const days = Number(body.days || 14)

    if (!org_id) return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const trialEnds = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    const upd = await supabase
      .from("organizations")
      .update({
        billing_status: "trialing",
        plan: "starter",
        trial_ends_at: trialEnds,
      })
      .eq("id", org_id)
      .select("id, plan, billing_status, trial_ends_at, current_period_end")
      .maybeSingle()

    if (upd.error) return NextResponse.json({ ok: false, where: "org update", error: upd.error }, { status: 500 })

    return NextResponse.json({ ok: true, org: upd.data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
