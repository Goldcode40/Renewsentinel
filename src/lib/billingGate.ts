import type { SupabaseClient } from "@supabase/supabase-js"

export type BillingGateResult =
  | { ok: true; org: any; access: "active" | "trial" }
  | { ok: false; status: number; error: string }

function isTrialValid(trialEndsAt: any) {
  if (!trialEndsAt) return false
  const t = new Date(trialEndsAt).getTime()
  if (!Number.isFinite(t)) return false
  return t > Date.now()
}

/**
 * Server-side billing gate:
 * ✅ allow if billing_status === "active"
 * ✅ allow if trial_ends_at is in the future
 * ❌ otherwise block with 403
 */
export async function requireActiveOrTrial(supabaseAdmin: SupabaseClient, orgId: string): Promise<BillingGateResult> {
  const id = String(orgId || "").trim()
  if (!id) return { ok: false, status: 400, error: "Missing org_id" }

  const orgRes = await supabaseAdmin
    .from("organizations")
    .select("id, plan, billing_status, trial_ends_at, current_period_end")
    .eq("id", id)
    .maybeSingle()

  if (orgRes.error) return { ok: false, status: 500, error: orgRes.error.message }
  if (!orgRes.data) return { ok: false, status: 404, error: "Org not found" }

  const billingStatus = String((orgRes.data as any)?.billing_status ?? "").trim().toLowerCase()
  const trialEndsAt = (orgRes.data as any)?.trial_ends_at

  if (billingStatus === "active") {
    return { ok: true, org: orgRes.data, access: "active" }
  }

  if (isTrialValid(trialEndsAt)) {
    return { ok: true, org: orgRes.data, access: "trial" }
  }

  return { ok: false, status: 403, error: "Upgrade required (not active and no valid trial)" }
}
