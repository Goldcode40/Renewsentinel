"use client"

import { useEffect, useMemo, useState } from "react"

type OrgRow = {
  id: string
  name: string
  created_at: string
  role: "owner" | "manager" | "viewer"
}

export default function DashboardPage() {
  // TEMP: dev user id until Supabase Auth is wired
  const userId = useMemo(() => "00000000-0000-0000-0000-000000000001", [])

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadOrgs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orgs?user_id=${encodeURIComponent(userId)}`)
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load orgs")
      setOrgs(json.orgs || [])
    } catch (e: any) {
      setError(e?.message ?? "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function createOrg() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/org/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_name: "Acme HVAC", user_id: userId }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to create org")
      await loadOrgs()
    } catch (e: any) {
      setError(e?.message ?? "Unknown error")
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    loadOrgs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">RenewSentinel Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Dev mode: using a fixed user_id until auth is wired.
        </p>
      </header>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Organizations</h2>
          <button
            onClick={createOrg}
            disabled={creating}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Org"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orgs yet. Click “Create Org”.</p>
        ) : (
          <ul className="divide-y">
            {orgs.map((o) => (
              <li key={o.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.id} • {new Date(o.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs">{o.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
