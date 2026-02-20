/**
 * RenewSentinel - Reminder Sender (stub)
 * Phase 2.3: prove the send loop works reliably.
 *
 * Behavior:
 * - Fetch reminder_events scheduled within the next N minutes (default 60)
 * - Only those with sent_at IS NULL
 * - Mark them sent (sent_at = now)
 *
 * Later we will actually send email via Mailpit/SMTP or a provider.
 */
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const MINUTES = parseInt(process.env.REMINDER_LOOKAHEAD_MINUTES || "60", 10)

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function addMinutes(d, minutes) {
  return new Date(d.getTime() + minutes * 60 * 1000)
}

async function main() {
  const now = new Date()
  const until = addMinutes(now, MINUTES)

  const { data, error } = await supabase
    .from("reminder_events")
    .select("id, org_id, item_id, scheduled_for, sent_at, meta")
    .is("sent_at", null)
    .gte("scheduled_for", now.toISOString())
    .lte("scheduled_for", until.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(500)

  if (error) throw error

  const rows = data ?? []
  if (rows.length === 0) {
    console.log(JSON.stringify({ ok: true, scanned: 0, marked_sent: 0 }, null, 2))
    return
  }

  const ids = rows.map((r) => r.id)

  const { error: updErr } = await supabase
    .from("reminder_events")
    .update({ sent_at: new Date().toISOString() })
    .in("id", ids)

  if (updErr) throw updErr

  console.log(JSON.stringify({ ok: true, scanned: rows.length, marked_sent: ids.length }, null, 2))
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
