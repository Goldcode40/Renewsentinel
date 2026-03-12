import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { requireActiveOrTrial } from "@/lib/billingGate"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get("org_id")

  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Missing org_id" }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

    // HARD GATE: GCAL Status is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabaseAdmin as any, orgId)
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      )
    }


  const { data, error } = await supabaseAdmin
    .from("oauth_tokens")
    .select("provider, expiry_date, updated_at, created_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    org_id: orgId,
    count: data?.length ?? 0,
    tokens: data ?? [],
  })
}

