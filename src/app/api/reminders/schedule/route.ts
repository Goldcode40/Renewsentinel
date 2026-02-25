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
      .select("id, org_id, title, expires_on")
      .eq("org_id", orgId)

    if (itemsErr) return Response.json({ ok: false, error: itemsErr.message }, { status: 500 })

    // Load insurance policies for org
    const { data: policies, error: polErr } = await supabaseAdmin
      .from("insurance_policies")
      .select("id, org_id, provider, policy_type, policy_number, expiry_date")
      .eq("org_id", orgId)

    if (polErr) return Response.json({ ok: false, error: polErr.message }, { status: 500 })

    // Load subcontractors (for name mapping)
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from("subcontractors")
      .select("id, org_id, name")
      .eq("org_id", orgId)

    if (subsErr) return Response.json({ ok: false, error: subsErr.message }, { status: 500 })

    const subNameById: Record<string, string> = {}
    for (const s of subs ?? []) {
      if (s?.id) subNameById[String(s.id)] = String(s.name ?? "")
    }

    // Load subcontractor docs with expirations
    const { data: subDocs, error: subErr } = await supabaseAdmin
      .from("subcontractor_documents")
      .select("id, org_id, subcontractor_id, doc_type, title, expires_on")
      .eq("org_id", orgId)

    if (subErr) return Response.json({ ok: false, error: subErr.message }, { status: 500 })

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

    // Helper to push a reminder row
    function pushRow(args: {
      entity_type: string
      entity_id: string
      item_id?: string | null
      whenIso: string
      meta: any
    }) {
      scheduledRows.push({
        org_id: orgId,
        item_id: args.item_id ?? null, // only for compliance_item
        entity_type: args.entity_type,
        entity_id: args.entity_id,
        channel: "email",
        kind: "pre_expiry",
        scheduled_for: args.whenIso,
        meta: args.meta,
      })
    }

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

        pushRow({
          entity_type: "compliance_item",
          entity_id: String(it.id),
          item_id: String(it.id),
          whenIso: when.toISOString(),
          meta: { entity: "compliance_item", offset_days: offset, title: it.title, expires_on: it.expires_on },
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

        pushRow({
          entity_type: "insurance_policy",
          entity_id: String(p.id),
          item_id: null,
          whenIso: when.toISOString(),
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

    // 3) Subcontractor documents
    for (const d of subDocs ?? []) {
      if (!d?.expires_on) continue
      const exp = parseDateOnly(d.expires_on)
      const daysLeft = daysBetween(now, exp)
      if (daysLeft < 0) continue
      if (daysLeft > maxDays) continue

      const subId = String(d.subcontractor_id ?? "")
      const subName = subNameById[subId] ?? ""

      for (const offset of reminderOffsets) {
        const when = addDays(exp, -offset)
        if (when.getTime() <= Date.now()) continue

        pushRow({
          entity_type: "subcontractor_document",
          entity_id: String(d.id),
          item_id: null,
          whenIso: when.toISOString(),
          meta: {
            entity: "subcontractor_document",
            offset_days: offset,
            subcontractor_id: subId,
            subcontractor_name: subName,
            doc_type: d.doc_type,
            title: d.title ?? null,
            expires_on: d.expires_on,
          },
        })
      }
    }

    if (scheduledRows.length === 0) {
      return Response.json({ ok: true, org_id: orgId, days: maxDays, scheduled: 0 })
    }

    // Dedupe by (org_id, entity_type, entity_id, channel, kind, scheduled_for)
    const entityKeys = Array.from(
      new Set(scheduledRows.map((r) => `${r.entity_type}|${r.entity_id}`))
    )

    // Load existing for this org (small scale; acceptable for MVP)
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("reminder_events")
      .select("entity_type, entity_id, channel, kind, scheduled_for")
      .eq("org_id", orgId)

    if (existErr) return Response.json({ ok: false, error: existErr.message }, { status: 500 })

    const existingKey = new Set(
      (existing ?? []).map(
        (r: any) =>
          `${r.entity_type}|${r.entity_id}|${r.channel}|${r.kind}|${new Date(r.scheduled_for).toISOString()}`
      )
    )

    const toInsert = scheduledRows.filter((r) => {
      const k = `${r.entity_type}|${r.entity_id}|${r.channel}|${r.kind}|${new Date(r.scheduled_for).toISOString()}`
      return !existingKey.has(k)
    })

    if (toInsert.length === 0) {
      return Response.json({ ok: true, org_id: orgId, days: maxDays, scheduled: 0 })
    }

    const { error: insErr } = await supabaseAdmin.from("reminder_events").insert(toInsert)
    if (insErr) return Response.json({ ok: false, error: insErr.message }, { status: 500 })

    return Response.json({ ok: true, org_id: orgId, days: maxDays, scheduled: toInsert.length })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}