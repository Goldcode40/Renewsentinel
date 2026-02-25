"use client"

import { useEffect, useMemo, useState } from "react"

type Org = {
  id: string
  name: string
  created_at: string
  role: string
}

type Subcontractor = {
  id: string
  org_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  trade: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type SubDoc = {
  id: string
  org_id: string
  subcontractor_id: string
  doc_type: string
  title: string | null
  expires_on: string | null
  filename: string | null
  content_type: string | null
  size_bytes: number | null
  storage_bucket: string | null
  storage_path: string | null
  created_at: string
  updated_at: string
}

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

export default function SubcontractorsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>("")
  const selectedOrg = useMemo(() => orgs.find((o) => o.id === orgId), [orgs, orgId])

  const [rows, setRows] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string>("")
  const [success, setSuccess] = useState<string>("")

  // subcontractor modal (add/edit)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editId, setEditId] = useState<string>("")

  // form
  const [name, setName] = useState("")
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [trade, setTrade] = useState("")
  const [notes, setNotes] = useState("")
  const [isActive, setIsActive] = useState(true)

  // docs modal
  const [docsOpen, setDocsOpen] = useState(false)
  const [docsFor, setDocsFor] = useState<Subcontractor | null>(null)
  const [docs, setDocs] = useState<SubDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsErr, setDocsErr] = useState("")
  const [docsSaving, setDocsSaving] = useState(false)
  const [uploadingDocId, setUploadingDocId] = useState<string>("")
  const [downloadingDocId, setDownloadingDocId] = useState<string>("")

  // docs form
  const [docType, setDocType] = useState("coi")
  const [docTitle, setDocTitle] = useState("")
  const [docExpiresOn, setDocExpiresOn] = useState("")

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

  async function loadSubs(nextOrgId?: string) {
    const oid = nextOrgId ?? orgId
    if (!oid) return
    setLoading(true)
    setErr("")
    try {
      const res = await fetch(`/api/subcontractors?org_id=${oid}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setErr(json?.error ?? "Failed to load subcontractors")
        setRows([])
        return
      }
      setRows(Array.isArray(json?.rows) ? json.rows : [])
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load subcontractors")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setName("")
    setContactName("")
    setEmail("")
    setPhone("")
    setTrade("")
    setNotes("")
    setIsActive(true)
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

  function openEdit(s: Subcontractor) {
    setErr("")
    setSuccess("")
    setMode("edit")
    setEditId(s.id)
    setName(s.name ?? "")
    setContactName(s.contact_name ?? "")
    setEmail(s.email ?? "")
    setPhone(s.phone ?? "")
    setTrade(s.trade ?? "")
    setNotes(s.notes ?? "")
    setIsActive(!!s.is_active)
    setOpen(true)
  }

  async function createSub() {
    if (!orgId) return
    if (!name.trim()) return setErr("Name is required")

    setSaving(true)
    setErr("")
    setSuccess("")
    try {
      const res = await fetch("/api/subcontractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          name: name.trim(),
          contact_name: contactName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          trade: trade.trim() || null,
          notes: notes.trim() || null,
          is_active: isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json?.error ?? "Create failed")
        return
      }

      setOpen(false)
      resetForm()
      setSuccess("Subcontractor saved.")
      await loadSubs(orgId)
      setTimeout(() => setSuccess(""), 4000)
    } catch (e: any) {
      setErr(e?.message ?? "Create failed")
    } finally {
      setSaving(false)
    }
  }

  async function updateSub() {
    if (!orgId) return
    if (!editId) return
    if (!name.trim()) return setErr("Name is required")

    setSaving(true)
    setErr("")
    setSuccess("")
    try {
      const res = await fetch(`/api/subcontractors/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          name: name.trim(),
          contact_name: contactName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          trade: trade.trim() || null,
          notes: notes.trim() || null,
          is_active: isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json?.error ?? "Update failed")
        return
      }

      setOpen(false)
      resetForm()
      setSuccess("Subcontractor updated.")
      await loadSubs(orgId)
      setTimeout(() => setSuccess(""), 4000)
    } catch (e: any) {
      setErr(e?.message ?? "Update failed")
    } finally {
      setSaving(false)
    }
  }

  async function deleteSub(s: Subcontractor) {
    if (!orgId) return
    const ok = confirm(`Delete subcontractor "${s.name}"?`)
    if (!ok) return

    setErr("")
    setSuccess("")
    try {
      const res = await fetch(`/api/subcontractors/${s.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        setErr(json?.error ?? "Delete failed")
        return
      }
      setSuccess("Subcontractor deleted.")
      await loadSubs(orgId)
      setTimeout(() => setSuccess(""), 3000)
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed")
    }
  }

  async function openDocs(s: Subcontractor) {
    if (!orgId) return
    setDocsFor(s)
    setDocsOpen(true)
    setDocs([])
    setDocsErr("")
    setDocType("coi")
    setDocTitle("")
    setDocExpiresOn("")
    await loadDocs(s.id)
  }

  async function loadDocs(subcontractorId: string) {
    if (!orgId) return
    setDocsLoading(true)
    setDocsErr("")
    try {
      const res = await fetch(`/api/subcontractor-docs?org_id=${orgId}&subcontractor_id=${subcontractorId}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setDocsErr(json?.error ?? "Failed to load docs")
        setDocs([])
        return
      }
      setDocs(Array.isArray(json?.rows) ? json.rows : [])
    } catch (e: any) {
      setDocsErr(e?.message ?? "Failed to load docs")
      setDocs([])
    } finally {
      setDocsLoading(false)
    }
  }

  async function addDoc() {
    if (!orgId) return
    if (!docsFor?.id) return
    if (!docType.trim()) return setDocsErr("doc_type is required")

    setDocsSaving(true)
    setDocsErr("")
    try {
      const res = await fetch("/api/subcontractor-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          subcontractor_id: docsFor.id,
          doc_type: docType.trim(),
          title: docTitle.trim() || null,
          expires_on: docExpiresOn.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setDocsErr(json?.error ?? "Failed to add doc")
        return
      }
      await loadDocs(docsFor.id)
      setDocTitle("")
      setDocExpiresOn("")
    } catch (e: any) {
      setDocsErr(e?.message ?? "Failed to add doc")
    } finally {
      setDocsSaving(false)
    }
  }

  async function downloadDoc(docId: string) {
    if (!orgId) return
    setDownloadingDocId(docId)
    setDocsErr("")
    try {
      const res = await fetch(`/api/subcontractor-docs/doc-url?org_id=${orgId}&doc_id=${docId}&expires=600`, { cache: "no-store" })
      const json = await res.json()
      if (!json?.ok || !json?.url) {
        setDocsErr(json?.error ?? "No download URL available")
        return
      }
      window.open(json.url, "_blank")
    } catch (e: any) {
      setDocsErr(e?.message ?? "Failed to get download URL")
    } finally {
      setDownloadingDocId("")
    }
  }

  async function uploadForDoc(e: React.FormEvent<HTMLFormElement>, subcontractorId: string, docId?: string) {
    e.preventDefault()
    if (!orgId) return

    const form = new FormData(e.currentTarget)
    form.set("org_id", orgId)
    form.set("subcontractor_id", subcontractorId)
    if (docId) form.set("doc_id", docId)

    setUploadingDocId(docId || "__new__")
    setDocsErr("")
    try {
      const res = await fetch("/api/subcontractor-docs/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!json?.ok) {
        setDocsErr(json?.error ?? "Upload failed")
        return
      }
      await loadDocs(subcontractorId)
      ;(e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement | null)?.value && ((e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement).value = "")
    } catch (err: any) {
      setDocsErr(err?.message ?? "Upload failed")
    } finally {
      setUploadingDocId("")
    }
  }

  useEffect(() => {
    loadOrgs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (orgId) loadSubs(orgId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const modalTitle = mode === "edit" ? "Edit subcontractor" : "Add subcontractor"
  const saveLabel = mode === "edit" ? "Save changes" : "Save subcontractor"
  const onSave = mode === "edit" ? updateSub : createSub

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Subcontractors (Dev)</h1>
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

          <button className="h-10 rounded bg-black px-4 text-white disabled:opacity-50" onClick={() => loadSubs(orgId)} disabled={!orgId || loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button className="h-10 rounded border px-4" onClick={openCreate} disabled={!orgId}>
            + Add subcontractor
          </button>

          <div className="text-sm text-gray-600">{selectedOrg ? <span className="font-mono">{selectedOrg.id}</span> : null}</div>
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">List</h2>
          <span className="text-sm text-gray-600">{rows.length} subcontractor(s)</span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No subcontractors yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Trade</th>
                  <th className="p-2">Contact</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Active</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2">{s.trade ?? "-"}</td>
                    <td className="p-2">{s.contact_name ?? "-"}</td>
                    <td className="p-2">{s.email ?? "-"}</td>
                    <td className="p-2">{s.phone ?? "-"}</td>
                    <td className="p-2">{s.is_active ? "Yes" : "No"}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => openDocs(s)} title="Docs">
                          📎 Docs
                        </button>
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => openEdit(s)} title="Edit">
                          ✏️ Edit
                        </button>
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => deleteSub(s)} title="Delete">
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

      {/* Add/Edit Subcontractor Modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-600">{modalTitle}</div>
                <div className="text-lg font-semibold">{selectedOrg?.name ?? "Organization"}</div>
              </div>
              <button className="rounded border px-2 py-1 text-sm hover:bg-gray-50" type="button" onClick={() => setOpen(false)} disabled={saving} title="Close">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Name *</label>
                <input className="h-10 rounded border px-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="ABC Electrical LLC" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Trade</label>
                <input className="h-10 rounded border px-3" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="electrical" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Contact name</label>
                <input className="h-10 rounded border px-3" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Email</label>
                  <input className="h-10 rounded border px-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@abc.com" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Phone</label>
                  <input className="h-10 rounded border px-3" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Notes</label>
                <textarea className="min-h-[80px] rounded border px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
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

      {/* Docs Modal */}
      {docsOpen && docsFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-600">Documents</div>
                <div className="text-lg font-semibold">{docsFor.name}</div>
              </div>
              <button className="rounded border px-2 py-1 text-sm hover:bg-gray-50" type="button" onClick={() => setDocsOpen(false)} disabled={docsSaving} title="Close">
                ✕
              </button>
            </div>

            {docsErr ? (
              <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{docsErr}</div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Doc type *</label>
                <select className="h-10 rounded border px-3" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="coi">coi</option>
                  <option value="w9">w9</option>
                  <option value="license">license</option>
                  <option value="cert">cert</option>
                  <option value="other">other</option>
                </select>
              </div>

              <div className="flex flex-1 flex-col">
                <label className="text-xs text-gray-600">Title</label>
                <input className="h-10 rounded border px-3" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="COI 2026" />
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Expires on</label>
                <input className="h-10 rounded border px-3" type="date" value={docExpiresOn} onChange={(e) => setDocExpiresOn(e.target.value)} />
              </div>

              <button className="h-10 rounded bg-black px-4 text-sm text-white disabled:opacity-50" onClick={addDoc} disabled={docsSaving}>
                {docsSaving ? "Adding..." : "Add doc"}
              </button>

              <button className="h-10 rounded border px-4 text-sm" onClick={() => loadDocs(docsFor.id)} disabled={docsLoading}>
                {docsLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="mt-4 rounded border">
              <div className="border-b bg-gray-50 px-3 py-2 text-sm font-medium">Docs</div>
              {docsLoading ? (
                <div className="p-3 text-sm text-gray-600">Loading…</div>
              ) : docs.length === 0 ? (
                <div className="p-3 text-sm text-gray-600">No docs yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2">Type</th>
                        <th className="p-2">Title</th>
                        <th className="p-2">Expires</th>
                        <th className="p-2">File</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id} className="border-b align-top">
                          <td className="p-2 font-mono">{d.doc_type}</td>
                          <td className="p-2">{d.title ?? "-"}</td>
                          <td className="p-2 font-mono">{d.expires_on ?? "-"}</td>
                          <td className="p-2">{d.filename ?? "-"}</td>
                          <td className="p-2">
                            <div className="flex flex-col gap-2">
                              <form onSubmit={(e) => uploadForDoc(e, docsFor.id, d.id)} className="flex items-center gap-2">
                                <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt" required className="text-xs" />
                                <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" type="submit" disabled={uploadingDocId === d.id}>
                                  {uploadingDocId === d.id ? "Uploading..." : "Upload/Replace"}
                                </button>
                              </form>

                              <button
                                className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                                disabled={!d.storage_path || downloadingDocId === d.id}
                                onClick={() => downloadDoc(d.id)}
                                title="Download latest file"
                              >
                                {downloadingDocId === d.id ? "Loading..." : "Download"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Upload a brand-new file as its own doc row */}
            <div className="mt-4 rounded border p-3">
              <div className="text-sm font-medium">Quick upload (creates a new doc row)</div>
              <div className="text-xs text-gray-600">If you just want to upload a file without creating a doc first.</div>
              <form onSubmit={(e) => uploadForDoc(e, docsFor.id)} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt" required className="text-xs" />
                <button className="rounded bg-black px-3 py-2 text-xs text-white disabled:opacity-50" type="submit" disabled={uploadingDocId === "__new__"}>
                  {uploadingDocId === "__new__" ? "Uploading..." : "Upload file"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}