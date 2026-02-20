"use client"

import { useEffect, useMemo, useState } from "react"

type Org = {
  id: string
  name: string
  created_at: string
  role: string
}

type Item = {
  id: string
  org_id: string
  type: string
  title: string
  issuer: string | null
  identifier: string | null
  expires_on: string
  renewal_window_days: number | null
  created_at: string
  updated_at: string
  status: "green" | "yellow" | "red"
  days_left: number
}

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

function clsStatus(s: Item["status"]) {
  if (s === "red") return "bg-red-100 text-red-800 border-red-200"
  if (s === "yellow") return "bg-yellow-100 text-yellow-800 border-yellow-200"
  return "bg-green-100 text-green-800 border-green-200"
}

export default function DashboardPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>("")
  const [days, setDays] = useState<number>(90)

  const [items, setItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [lastScheduled, setLastScheduled] = useState<number | null>(null)
  const [err, setErr] = useState<string>("")

  // Create form
  const [type, setType] = useState<string>("license")
  const [title, setTitle] = useState<string>("")
  const [issuer, setIssuer] = useState<string>("")
  const [identifier, setIdentifier] = useState<string>("")
  const [expiresOn, setExpiresOn] = useState<string>("")
  const [renewalWindowDays, setRenewalWindowDays] = useState<number>(30)
  const [creating, setCreating] = useState(false)

  const selectedOrg = useMemo(() => orgs.find(o => o.id === orgId), [orgs, orgId])

  async function loadOrgs() {
    setErr("")
    const res = await fetch(`/api/orgs?user_id=${DEV_USER_ID}`, { cache: "no-store" })
    const json = await res.json()
    if (!json?.ok) {
      setErr(json?.error ?? "Failed to load orgs")
      return
    }
    setOrgs(json.orgs ?? [])
    if (!orgId && (json.orgs?.length ?? 0) > 0) {
      setOrgId(json.orgs[0].id)
    }
  }

  async function loadItems(nextOrgId?: string, nextDays?: number) {
    const oid = nextOrgId ?? orgId
    const d = nextDays ?? days
    if (!oid) return

    setLoadingItems(true)
    setErr("")
    try {
      const res = await fetch(`/api/items/next?org_id=${oid}&days=${d}`, { cache: "no-store" })
      const json = await res.json()
      if (!json?.ok) {
        setErr(json?.error ?? "Failed to load items")
        setItems([])
        return
      }
      setItems(json.items ?? [])
    } finally {
      setLoadingItems(false)
    }
  }

  async function deleteItem(id: string) {
    try {
      setErr("")
      if (!orgId) return
      const res = await fetch(`/api/items/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, org_id: orgId }),
      })
      const json = await res.json()
      if (!json?.ok) {
        setErr(json?.error ?? "Failed to delete item")
        return
      }
      await loadItems(orgId, days)
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete item")
    }
  }

  async function updateItem(id: string, patch: { title?: string; expires_on?: string }) {
    try {
      setErr("")
      if (!orgId) return
      const res = await fetch(`/api/items/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, org_id: orgId, ...patch }),
      })
      const json = await res.json()
      if (!json?.ok) {
        setErr(json?.error ?? "Failed to update item")
        return
      }
      await loadItems(orgId, days)
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update item")
    }
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    if (!title.trim()) return setErr("Title is required")
    if (!expiresOn.trim()) return setErr("Expires on is required")

    setCreating(true)
    setErr("")
    try {
      const res = await fetch("/api/items/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          type: type.trim(),
          title: title.trim(),
          issuer: issuer.trim() || null,
          identifier: identifier.trim() || null,
          expires_on: expiresOn,
          renewal_window_days: renewalWindowDays,
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        setErr(json?.error ?? "Create failed")
        return
      }

      // Clear minimal fields
      setTitle("")
      setIssuer("")
      setIdentifier("")
      setExpiresOn("")
      setRenewalWindowDays(30)

      await loadItems(orgId, days)
    } finally {
      setCreating(false)
    }
  }

  async function scheduleReminders() {
    try {
      setErr("")
      setLastScheduled(null)
      if (!orgId) return
      setScheduling(true)
      const res = await fetch("/api/reminders/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, days }),
      })
      const json = await res.json()
      if (!json?.ok) {
        setErr(json?.error ?? "Failed to schedule reminders")
        return
      }
      setLastScheduled(json.scheduled ?? 0)
    } catch (e: any) {
      setErr(e?.message ?? "Failed to schedule reminders")
    } finally {
      setScheduling(false)
    }
  }

  useEffect(() => {
    loadOrgs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  useEffect(() => {
    if (orgId) loadItems(orgId, days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">RenewSentinel Dashboard (Dev)</h1>
        <p className="text-sm text-gray-600">
          Dev user: <span className="font-mono">{DEV_USER_ID}</span>
        </p>
      </div>

      {err ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Organization</label>
            <select
              className="h-10 rounded border px-3"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Window (days)</label>
            <input
              className="h-10 w-28 rounded border px-3"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value || "90", 10))}
            />
          </div>

          <button
            className="h-10 rounded bg-black px-4 text-white disabled:opacity-50"
            onClick={() => loadItems(orgId, days)}
            disabled={!orgId || loadingItems}
          >
            {loadingItems ? "Loading..." : "Refresh"}          </button>

          <button
            className="h-10 rounded border px-4 disabled:opacity-50"
            onClick={scheduleReminders}
            disabled={!orgId || scheduling}
            title="Generate reminder events (deduped)"
          >
            {scheduling ? "Scheduling..." : "Schedule reminders"}          </button>

          <button
            className="h-10 rounded border px-4 disabled:opacity-50"
            onClick={() => {
              if (!orgId) return
              window.open(`/api/reminders?org_id=${orgId}&limit=50`, "_blank")
            }}
            disabled={!orgId}
            title="Open scheduled reminders (JSON)"
          >
            View reminders
          </button>

          <div className="text-sm text-gray-600">
            {selectedOrg ? (
              <span className="font-mono">{selectedOrg.id}</span>
            ) : null}
          </div>          {typeof lastScheduled === "number" ? (
            <div className="text-xs text-gray-600">Scheduled: {lastScheduled}</div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="text-lg font-semibold">Create compliance item</h2>

          <form className="space-y-3" onSubmit={createItem}>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Type</label>
                <input
                  className="h-10 rounded border px-3"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="license | insurance | permit | training | ..."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Title *</label>
                <input
                  className="h-10 rounded border px-3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="HVAC Contractor License"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Issuer</label>
                <input
                  className="h-10 rounded border px-3"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="State Board"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Identifier</label>
                <input
                  className="h-10 rounded border px-3"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="HVAC-12345"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Expires on *</label>
                <input
                  className="h-10 rounded border px-3"
                  type="date"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Renewal window (days)</label>
                <input
                  className="h-10 rounded border px-3"
                  type="number"
                  min={1}
                  max={3650}
                  value={renewalWindowDays}
                  onChange={(e) => setRenewalWindowDays(parseInt(e.target.value || "30", 10))}
                />
              </div>
            </div>

            <button
              className="h-10 w-full rounded bg-black px-4 text-white disabled:opacity-50"
              type="submit"
              disabled={!orgId || creating}
            >
              {creating ? "Creating..." : "Create item"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Next {days} days</h2>
            <span className="text-sm text-gray-600">{items.length} item(s)</span>
          </div>

          {loadingItems ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-600">No items within window.</div>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{it.title}</div>
                      <div className="text-sm text-gray-600">
                        <span className="font-mono">{it.type}</span>
                        {it.issuer ? <> · {it.issuer}</> : null}
                        {it.identifier ? <> · {it.identifier}</> : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded border px-2 py-1 text-xs font-medium ${clsStatus(it.status)}`}>
                        {it.status.toUpperCase()}
                      </span>
                      <div className="text-sm">
                        <span className="font-medium">{it.days_left}</span> days
                      </div>

                      <button
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => {
                          if (confirm("Delete this item?")) deleteItem(it.id)
                        }}
                        title="Delete"
                      >
                        🗑️ Delete
                      </button>

                      <button
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => {
                          const nextTitle = prompt("New title:", it.title) ?? ""
                          if (!nextTitle.trim()) return
                          updateItem(it.id, { title: nextTitle.trim() })
                        }}
                        title="Edit title"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">
                    Expires: <span className="font-mono">{it.expires_on}</span>
                    {typeof it.renewal_window_days === "number" ? (
                      <> · Window: {it.renewal_window_days}d</>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}












