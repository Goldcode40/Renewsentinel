"use client"

import { useEffect, useMemo, useState } from "react"

type Org = {
  id: string
  name: string
  created_at: string
  role: string
}

type Policy = {
  id: string
  org_id: string
  provider: string
  policy_number: string | null
  policy_type: string
  effective_date: string | null
  expiry_date: string
  coverage_amount: number | null
  document_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

export default function InsurancePage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>("")
  const selectedOrg = useMemo(() => orgs.find((o) => o.id === orgId), [orgs, orgId])

  const [rows, setRows] = useState<Policy[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string>("")
  const [success, setSuccess] = useState<string>("")

  // modal
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editId, setEditId] = useState<string>("")

  // form fields
  const [provider, setProvider] = useState("")
  const [policyType, setPolicyType] = useState("General Liability")
  const [policyNumber, setPolicyNumber] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [coverageAmount, setCoverageAmount] = useState("")
  const [notes, setNotes] = useState("")

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

  async function loadPolicies(nextOrgId?: string) {
    const oid = nextOrgId ?? orgId
    if (!oid) return
    setLoading(true)
    setErr("")
    try {
      const res = await fetch(`/api/insurance?org_id=${oid}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setErr(json?.error ?? "Failed to load policies")
        setRows([])
        return
      }
      setRows(Array.isArray(json?.rows) ? json.rows : [])
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load policies")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setProvider("")
    setPolicyType("General Liability")
    setPolicyNumber("")
    setEffectiveDate("")
    setExpiryDate("")
    setCoverageAmount("")
    setNotes("")
    setEditId("")
    setMode("create")
  }

  function openCreate() {
    setErr("")
    setSuccess("")
    resetForm()
    setMode("create")
    setOpen(true)
  }

  function openEdit(p: Policy) {
    setErr("")
    setSuccess("")
    setMode("edit")
    setEditId(p.id)
    setProvider(p.provider ?? "")
    setPolicyType(p.policy_type ?? "")
    setPolicyNumber(p.policy_number ?? "")
    setEffectiveDate(p.effective_date ?? "")
    setExpiryDate(p.expiry_date ?? "")
    setCoverageAmount(typeof p.coverage_amount === "number" ? String(p.coverage_amount) : "")
    setNotes(p.notes ?? "")
    setOpen(true)
  }

  async function createPolicy() {
    if (!orgId) return
    if (!provider.trim()) return setErr("Provider is required")
    if (!policyType.trim()) return setErr("Policy type is required")
    if (!expiryDate.trim()) return setErr("Expiry date is required")

    setSaving(true)
    setErr("")
    setSuccess("")
    try {
      const res = await fetch("/api/insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          provider: provider.trim(),
          policy_type: policyType.trim(),
          policy_number: policyNumber.trim() || null,
          effective_date: effectiveDate.trim() || null,
          expiry_date: expiryDate.trim(),
          coverage_amount: coverageAmount.trim() ? Number(coverageAmount.trim()) : null,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json?.error ?? "Create failed")
        return
      }

      setOpen(false)
      resetForm()
      setSuccess("Insurance policy saved.")
      await loadPolicies(orgId)
      setTimeout(() => setSuccess(""), 4000)
    } catch (e: any) {
      setErr(e?.message ?? "Create failed")
    } finally {
      setSaving(false)
    }
  }

  async function updatePolicy() {
    if (!orgId) return
    if (!editId) return
    if (!provider.trim()) return setErr("Provider is required")
    if (!policyType.trim()) return setErr("Policy type is required")
    if (!expiryDate.trim()) return setErr("Expiry date is required")

    setSaving(true)
    setErr("")
    setSuccess("")
    try {
      const res = await fetch(`/api/insurance/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          provider: provider.trim(),
          policy_type: policyType.trim(),
          policy_number: policyNumber.trim() || null,
          effective_date: effectiveDate.trim() || null,
          expiry_date: expiryDate.trim(),
          coverage_amount: coverageAmount.trim() ? Number(coverageAmount.trim()) : null,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json?.error ?? "Update failed")
        return
      }

      setOpen(false)
      resetForm()
      setSuccess("Insurance policy updated.")
      await loadPolicies(orgId)
      setTimeout(() => setSuccess(""), 4000)
    } catch (e: any) {
      setErr(e?.message ?? "Update failed")
    } finally {
      setSaving(false)
    }
  }

  async function deletePolicy(p: Policy) {
    if (!orgId) return
    const ok = confirm(`Delete policy "${p.provider} - ${p.policy_type}"?`)
    if (!ok) return

    setErr("")
    setSuccess("")
    try {
      const res = await fetch(`/api/insurance/${p.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        setErr(json?.error ?? "Delete failed")
        return
      }
      setSuccess("Policy deleted.")
      await loadPolicies(orgId)
      setTimeout(() => setSuccess(""), 3000)
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed")
    }
  }

  useEffect(() => {
    loadOrgs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (orgId) loadPolicies(orgId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const modalTitle = mode === "edit" ? "Edit insurance policy" : "Add insurance policy"
  const saveLabel = mode === "edit" ? "Save changes" : "Save policy"
  const onSave = mode === "edit" ? updatePolicy : createPolicy

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Insurance Tracking (Dev)</h1>
        <p className="text-sm text-gray-600">
          Dev user: <span className="font-mono">{DEV_USER_ID}</span>
        </p>
      </div>

      {err ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      ) : null}

      {success ? (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">{success}</div>
      ) : null}

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Organization</label>
            <select className="h-10 rounded border px-3" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))}
            </select>
          </div>

          <button
            className="h-10 rounded bg-black px-4 text-white disabled:opacity-50"
            onClick={() => loadPolicies(orgId)}
            disabled={!orgId || loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button className="h-10 rounded border px-4" onClick={openCreate} disabled={!orgId}>
            + Add policy
          </button>

          <div className="text-sm text-gray-600">{selectedOrg ? <span className="font-mono">{selectedOrg.id}</span> : null}</div>
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Policies</h2>
          <span className="text-sm text-gray-600">{rows.length} policy(s)</span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No policies yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-2">Provider</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Policy #</th>
                  <th className="p-2">Effective</th>
                  <th className="p-2">Expiry</th>
                  <th className="p-2">Coverage</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2 font-medium">{p.provider}</td>
                    <td className="p-2">{p.policy_type}</td>
                    <td className="p-2 font-mono">{p.policy_number ?? "-"}</td>
                    <td className="p-2 font-mono">{p.effective_date ?? "-"}</td>
                    <td className="p-2 font-mono">{p.expiry_date}</td>
                    <td className="p-2">{typeof p.coverage_amount === "number" ? p.coverage_amount.toLocaleString() : "-"}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => openEdit(p)} title="Edit">
                          ✏️ Edit
                        </button>
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => deletePolicy(p)} title="Delete">
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add/Edit Policy Modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-600">{modalTitle}</div>
                <div className="text-lg font-semibold">{selectedOrg?.name ?? "Organization"}</div>
              </div>
              <button
                className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Provider *</label>
                <input className="h-10 rounded border px-3" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Acme Insurance" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Policy type *</label>
                <input className="h-10 rounded border px-3" value={policyType} onChange={(e) => setPolicyType(e.target.value)} placeholder="General Liability" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Policy number</label>
                <input className="h-10 rounded border px-3" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="GL-12345" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Effective date</label>
                  <input className="h-10 rounded border px-3" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Expiry date *</label>
                  <input className="h-10 rounded border px-3" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Coverage amount</label>
                <input className="h-10 rounded border px-3" value={coverageAmount} onChange={(e) => setCoverageAmount(e.target.value)} placeholder="1000000" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Notes</label>
                <textarea className="min-h-[80px] rounded border px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="h-10 rounded border px-4 text-sm hover:bg-gray-50 disabled:opacity-50" type="button" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button className="h-10 rounded bg-black px-4 text-sm text-white disabled:opacity-50" type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : saveLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}