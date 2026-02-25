import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  org_id?: string
  days?: number // lookahead window for items, default 90
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as Body

    const orgId = (body.org_id ?? "").trim()
    const maxDays = typeof body.days === "number" ? Math.max(1, Math.min(3650, body.days)) : 90

    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    // Load compliance items for org
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("compliance_items")
      .select("id, org_id, title, expires_on, renewal_window_days")
      .eq("org_id", orgId)

    if (itemsErr) {
      return Response.json({ ok: false, error: itemsErr.message }, { status: 500 })
    }

    // Load insurance policies for org
    const { data: policies, error: polErr } = await supabaseAdmin
      .from("insurance_policies")
      .select("id, org_id, provider, policy_type, policy_number, effective_date, expiry_date")
      .eq("org_id", orgId)

    if (polErr) {
      return Response.json({ ok: false, error: polErr.message }, { status: 500 })
    }

    const reminderOffsets = [30, 14, 7, 1] // days before expiry

    function parseDateOnly(s: string): Date {
      return new Date(`${s}T00:00:00.000Z`)
    }
    function addDays(d: Date, days: number): Date {
      return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
    }
    function daysBetween(a: Date, b: Date) {
      return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
    }

    const now = new Date()
    const scheduledRows: any[] = []

    // 1) Compliance items
    for (const it of items ?? []) {
      if (!it?.expires_on) continue
      const exp = parseDateOnly(it.expires_on)
      const daysLeft = daysBetween(now, exp)

      if (daysLeft < 0) continue
      if (daysLeft > maxDays) continue

      for (const offset of reminderOffsets) {
        const when = addDays(exp, -offset)
        if (when.getTime() <= Date.now()) continue

        scheduledRows.push({
          org_id: orgId,
          item_id: it.id,
          channel: "email",
          kind: "pre_expiry",
          scheduled_for: when.toISOString(),
          meta: {
            entity: "compliance_item",
            offset_days: offset,
            title: it.title,
            expires_on: it.expires_on,
          },
        })
      }
    }

    // 2) Insurance policies
    for (const p of policies ?? []) {
      if (!p?.expiry_date) continue
      const exp = parseDateOnly(p.expiry_date)
      const daysLeft = daysBetween(now, exp)

      if (daysLeft < 0) continue
      if (daysLeft > maxDays) continue

      for (const offset of reminderOffsets) {
        const when = addDays(exp, -offset)
        if (when.getTime() <= Date.now()) continue

        scheduledRows.push({
          org_id: orgId,
          item_id: p.id, // reuse column as generic entity id
          channel: "email",
          kind: "pre_expiry",
          scheduled_for: when.toISOString(),
          meta: {
            entity: "insurance_policy",
            offset_days: offset,
            provider: p.provider,
            policy_type: p.policy_type,
            policy_number: p.policy_number,
            expiry_date: p.expiry_date,
          },
        })
      }
    }

    // Dedupe: don't insert the same (org_id, item_id, channel, kind, scheduled_for) twice.
    const itemIds = Array.from(new Set(scheduledRows.map((r) => r.item_id)))

    if (itemIds.length === 0) {
      return Response.json({ ok: true, org_id: orgId, days: maxDays, scheduled: 0 })
    }

    const { data: existing, error: existErr } = await supabaseAdmin
      .from("reminder_events")
      .select("item_id, channel, kind, scheduled_for")
      .eq("org_id", orgId)
      .in("item_id", itemIds)

    if (existErr) {
      return Response.json({ ok: false, error: existErr.message }, { status: 500 })
    }

    const existingKey = new Set(
      (existing ?? []).map(
        (r: any) => `${r.item_id}|${r.channel}|${r.kind}|${new Date(r.scheduled_for).toISOString()}`
      )
    )

    const toInsert = scheduledRows.filter((r) => {
      const k = `${r.item_id}|${r.channel}|${r.kind}|${new Date(r.scheduled_for).toISOString()}`
      return !existingKey.has(k)
    })

    if (toInsert.length === 0) {
      return Response.json({ ok: true, org_id: orgId, days: maxDays, scheduled: 0 })
    }

    const { error: insErr } = await supabaseAdmin.from("reminder_events").insert(toInsert)
    if (insErr) {
      return Response.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    return Response.json({ ok: true, org_id: orgId, days: maxDays, scheduled: toInsert.length })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}