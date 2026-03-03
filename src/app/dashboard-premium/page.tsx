"use client"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
type Org = {
  id: string
  name: string
  created_at: string
  role: string
  profile_state?: string | null
  profile_trade?: string | null
  plan?: string | null
  billing_status?: string | null
  current_period_end?: string | null
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

type ConciergeDoc = {
  id: string
  request_id: string
  doc_type: string
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
  path: string
}

type ConciergeRequest = {
  id: string
  org_id: string
  status: "submitted" | "in_progress" | "completed"
  profile_state: string | null
  profile_trade: string | null
  notes: string | null
  assigned_to: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

type ConciergePayload = {
  request: ConciergeRequest | null
  documents: ConciergeDoc[]
  viewer_role?: string
  error?: string
}
function clsStatus(s: Item["status"]) {
if (s === "red") return "bg-red-100 text-red-800 border-red-200"
if (s === "yellow") return "bg-yellow-100 text-yellow-800 border-yellow-200"
return "bg-green-100 text-green-800 border-green-200"
}
export default function DashboardPage() {
type RequirementRow = {
id: string;
state: string;
trade: string;
requirement_type: string;
title: string;
};
  function applyRequirementToForm(r: RequirementRow) {
    setType(r.requirement_type || "");
    setTitle(r.title || "");
    setIssuer("");
setIdentifier("");
    setRenewalWindowDays(typeof (r as any).renewal_window_days === "number" ? (r as any).renewal_window_days : 30);
// user must set expires date manually
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }  async function applyRequirement(templateId: string, templateTitle?: string) {
    if (!orgId) {
      setReqError("Select an organization first.");
      return;
    }
    setReqError("");
    setApplyTemplateId(templateId);
    setApplyTemplateTitle(templateTitle ?? "");
    setApplyExpiresOn("");
    setApplyOpen(true);
  }

  async function confirmApplyRequirement() {
    if (!orgId) return;
    if (!applyTemplateId) return;

    if (!applyExpiresOn.trim()) {
      setReqError("Expiry date is required.");
      return;
    }

    setApplySaving(true);
    setReqError("");
    try {
      const res = await fetch("/api/requirements/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          template_id: applyTemplateId,
          expires_on: applyExpiresOn.trim(),
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        setReqError(json?.error || "Failed to apply requirement");
        return;
      }

            setApplyOpen(false);

      // Success banner (helps when the new item is outside the current window)
      try {
        const now = new Date();
        const exp = new Date(applyExpiresOn + "T00:00:00");
        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const outside = typeof daysLeft === "number" && daysLeft > days;
        setApplySuccess(
          outside
            ? `Added to tracking. Expires in ${daysLeft} days (outside your current ${days}-day window).`
            : `Added to tracking. Expires in ${daysLeft} days.`
        );
        setApplySuccessOutside(!!outside);
      } catch {
        setApplySuccess("Added to tracking.");
        setApplySuccessOutside(false);
      }

      await loadItems(orgId, days);
// If this was triggered from "Add selected", advance to the next checked requirement
      setSelectedReqIds((prev) => {
        const next = { ...prev };
        if (applyTemplateId) next[applyTemplateId] = false;
        return next;
      });

      // Find next selected requirement and continue the flow
      const nextId = Object.keys(selectedReqIds).find((id) => selectedReqIds[id] && id !== applyTemplateId);
      if (nextId) {
        const row = requirements.find((r) => r.id === nextId);
        if (row) {
          // keep modal open and prompt for next expiry
          setApplyTemplateId(row.id);
          setApplyTemplateTitle(row.title);
          setApplyExpiresOn("");
          setApplyOpen(true);
          return;
        }
      }

      // auto-clear banner after 6s
      setTimeout(() => {
        setApplySuccess("");
        setApplySuccessOutside(false);
      }, 6000);
    } catch (e: any) {
      setReqError(e?.message || "Failed to apply requirement");
    } finally {
      setApplySaving(false);
    }
  }

  const [reqState, setReqState] = useState<string>("NH");
const [reqTrade, setReqTrade] = useState<string>("hvac");
const [requirements, setRequirements] = useState<RequirementRow[]>([]);
const [selectedReqIds, setSelectedReqIds] = useState<Record<string, boolean>>({});const [reqLoading, setReqLoading] = useState<boolean>(false);
const [reqError, setReqError] = useState<string>("");
const [applyOpen, setApplyOpen] = useState<boolean>(false);
  const [applyTemplateId, setApplyTemplateId] = useState<string>("");
  const [applyTemplateTitle, setApplyTemplateTitle] = useState<string>("");
  const [applyExpiresOn, setApplyExpiresOn] = useState<string>("");
  const [applySaving, setApplySaving] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<string>("");
  const [applySuccessOutside, setApplySuccessOutside] = useState<boolean>(false);
async function loadRequirements() {
setReqLoading(true);
setReqError("");
try {
const qs = new URLSearchParams({
state: reqState,
trade: reqTrade,
});
const res = await fetch(`/api/requirements?${qs.toString()}`);
const json = await res.json();
if (!res.ok) {
setReqError(json?.error || "Failed to load requirements");
setRequirements([]);
return;
}
const rows = Array.isArray(json?.rows) ? json.rows : [];
      setRequirements(rows);
      // reset selection on load
      const nextSel: Record<string, boolean> = {};
      for (const r of rows) nextSel[r.id] = false;
      setSelectedReqIds(nextSel);
} catch (e: any) {
setReqError(e?.message || "Failed to load requirements");
setRequirements([]);
} finally {
setReqLoading(false);
}
}
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
const searchParams = useSearchParams()


const selectedOrg = useMemo(() => orgs.find(o => o.id === orgId), [orgs, orgId])

const isActive = (String(selectedOrg?.billing_status ?? "").trim().toLowerCase() === "active")
const showUpgrade = (!isActive) || (searchParams.get("show_upgrade") === "1")
async function goBilling(mode: "checkout" | "portal") {
  try {
    setErr("")
    if (!orgId) return
    const endpoint = mode === "portal" ? "/api/billing/portal" : "/api/billing/checkout"
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    })
    const json = await res.json().catch(() => ({} as any))
    const url = json?.url ?? json?.portal_url
    if (!res.ok || !url) {
      setErr(json?.error ?? ("Billing request failed (" + res.status + ")"))
      return
    }
    window.location.href = url
  } catch (e: any) {
    setErr(e?.message ?? "Billing request failed")
  }
}// Concierge (Phase 6.2)
const [concierge, setConcierge] = useState<ConciergePayload>({ request: null, documents: [], viewer_role: "" })
const [conciergeLoading, setConciergeLoading] = useState<boolean>(false)
const [conciergeErr, setConciergeErr] = useState<string>("")
const [conciergeNotes, setConciergeNotes] = useState<string>("")
const [conciergeDocType, setConciergeDocType] = useState<string>("license")
const [conciergeUploading, setConciergeUploading] = useState<boolean>(false)
async function openConciergeDoc(docId: string) {
  if (!orgId) return
  setConciergeErr("")
  try {
    const qs = new URLSearchParams({ org_id: orgId, doc_id: docId, expires: "600" })
    const res = await fetch(`/api/concierge/doc-url?${qs.toString()}`, { cache: "no-store" })
    const json = await res.json()
    if (!res.ok || !json?.ok || !json?.url) {
      setConciergeErr(json?.error ?? "Failed to get download link")
      return
    }
    window.open(json.url, "_blank")
  } catch (e: any) {
    setConciergeErr(e?.message ?? "Failed to get download link")
  }
}


function badgeForStatus(status: string | undefined | null) {
  if (status === "completed") return "bg-green-100 text-green-800 border-green-200"
  if (status === "in_progress") return "bg-blue-100 text-blue-800 border-blue-200"
  return "bg-yellow-100 text-yellow-800 border-yellow-200"
}

async function loadConcierge(oid?: string) {
  const useOrg = oid ?? orgId
  if (!useOrg) return
  setConciergeLoading(true)
  setConciergeErr("")
  try {
    const qs = new URLSearchParams({ org_id: useOrg, user_id: DEV_USER_ID })
    const res = await fetch(`/api/concierge?${qs.toString()}`, { cache: "no-store" })
    const json = await res.json()
    if (!res.ok) {
      setConciergeErr(json?.error ?? "Failed to load concierge")
      setConcierge({ request: null, documents: [], viewer_role: "" })
      return
    }
    setConcierge({
      request: json?.request ?? null,
      documents: Array.isArray(json?.documents) ? json.documents : [],
      viewer_role: json?.viewer_role ?? ""
    })
  } catch (e: any) {
    setConciergeErr(e?.message ?? "Failed to load concierge")
    setConcierge({ request: null, documents: [], viewer_role: "" })
  } finally {
    setConciergeLoading(false)
  }
}

async function submitConcierge() {
  if (!orgId) return
  setConciergeErr("")
  try {
    const res = await fetch("/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        user_id: DEV_USER_ID,
        status: "submitted",
        notes: conciergeNotes.trim() || "Please set up my compliance tracking."
      }),
    })
    const json = await res.json()
    if (!res.ok || !json?.request?.id) {
      setConciergeErr(json?.error ?? "Submit failed")
      return
    }
    await loadConcierge(orgId)
  } catch (e: any) {
    setConciergeErr(e?.message ?? "Submit failed")
  }
}

async function uploadConciergeDoc(file: File) {
  if (!orgId) return
  const requestId = concierge?.request?.id
  if (!requestId) {
    setConciergeErr("Submit your concierge request first, then upload documents.")
    return
  }

  

async function deleteConciergeDoc(docId: string) {
  if (!orgId) return
  try {
    setConciergeErr("")
    const res = await fetch("/api/concierge/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_doc", org_id: orgId, doc_id: docId }),
    })
    const json = await res.json()
    if (!json?.ok) {
      setConciergeErr(json?.error ?? "Delete failed")
      return
    }
    await loadConcierge(orgId)
  } catch (e: any) {
    setConciergeErr(e?.message ?? "Delete failed")
  }
}setConciergeUploading(true)
  setConciergeErr("")
  try {
    const fd = new FormData()
    fd.append("org_id", orgId)
    fd.append("request_id", requestId)
    fd.append("doc_type", conciergeDocType)
    fd.append("file", file)

    const res = await fetch("/api/concierge/upload", { method: "POST", body: fd })
    const json = await res.json()
    if (!res.ok || !json?.ok) {
      setConciergeErr(json?.error ?? "Upload failed")
      return
    }

    await loadConcierge(orgId)
  } catch (e: any) {
    setConciergeErr(e?.message ?? "Upload failed")
  } finally {
    setConciergeUploading(false)
  }
}


  async function saveOrgProfile(nextState?: string, nextTrade?: string) {
    if (!orgId) return
    try {
      await fetch("/api/orgs/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          profile_state: (nextState ?? reqState).toUpperCase(),
          profile_trade: (nextTrade ?? reqTrade).toLowerCase(),
        }),
      })
    } catch {
      // ignore (dev UX)
    }
  }
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
  if (!orgId) return
  loadItems(orgId, days)
  loadConcierge(orgId)

  setApplySuccess("")
  setApplySuccessOutside(false)

  // Apply org profile defaults to wizard
  const org = orgs.find(o => o.id === orgId)
  if (org?.profile_state) setReqState(String(org.profile_state).toUpperCase())
  if (org?.profile_trade) setReqTrade(String(org.profile_trade).toLowerCase())
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [orgId, orgs])


  // Auto-load requirements (wizard feel)
  useEffect(() => {
    if (!reqState || !reqTrade) return;
    loadRequirements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqState, reqTrade]);
return (
<div className="rs-premium"><div className="rs-shell">
<div className="rs-premium"><div className="rs-shell"><main className="mx-auto max-w-5xl p-6 space-y-6">
<div className="rs-card p-8 space-y-4 mb-6">
  <div className="flex flex-col gap-2">
    <h1 className="text-4xl font-bold tracking-tight">
      Never Get Surprised Again
    </h1>
    <p className="text-lg text-gray-600">
      See renewals before they hit. Export proof packs in one click.
    </p>
  </div>
      {/* KPI STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="rs-card rounded-xl p-6 text-center">
          <div className="text-sm text-gray-500">Upcoming Renewals</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{items.length}</div>
        </div>

        <div className="rs-card rounded-xl p-6 text-center">
          <div className="text-sm text-gray-500">Items Tracked</div>
          <div className="text-3xl font-bold mt-2">{items.length}</div>
        </div>

        <div className="rs-card rounded-xl p-6 text-center">
          <div className="text-sm text-gray-500">Proof Pack</div>
          <div className="text-sm mt-3 font-medium text-blue-600">Ready to Export</div>
        </div>
      </div>

{/* Concierge (Phase 6.2) */}
<section className="rs-card p-6 space-y-4 border border-gray-200 rounded-xl">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="text-xl font-semibold">We set it up for you</h2>
      <p className="text-sm text-gray-600 mt-1">
        Submit your request + upload any docs. Weâ€™ll configure your requirements and tracking.
      </p>
    </div>

    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Org:</span>
<span className="text-xs font-mono">{orgId || "(none)"}</span>
<span className="text-xs text-gray-500">Role:</span>
<span className="text-xs font-medium">{concierge.viewer_role || "unknown"}</span>
      {concierge.request?.status ? (
        <span className={`rounded border px-2 py-1 text-xs font-medium ${badgeForStatus(concierge.request.status)}`}>
          {concierge.request.status.replace("_", " ").toUpperCase()}
        </span>
      ) : (
        <span className="rounded border px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 border-gray-200">
          NOT SUBMITTED
        </span>
      )}
    </div>
  </div>

  {conciergeErr ? (
    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {conciergeErr}
    </div>
  ) : null}

  {conciergeLoading ? (
    <div className="text-sm text-gray-500">Loading concierge...</div>
  ) : null}

  {/* Permission gate */}
  {concierge.viewer_role && concierge.viewer_role !== "owner" && concierge.viewer_role !== "admin" ? (
    <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
      Only an owner/admin can submit or view concierge setup details for this organization.
    </div>
  ) : (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Intake / Submit */}
      <div className="space-y-3">
        <div className="text-sm font-semibold">1) Submit setup request</div>
        <div className="text-sm text-gray-600">
          Tell us anything special. Weâ€™ll use your org profile defaults:
          <span className="font-mono"> {reqState}</span> / <span className="font-mono">{reqTrade}</span>
        </div>

        <textarea
          className="w-full min-h-[110px] rounded border p-3 text-sm"
          placeholder="Notes (optional): licenses, towns, special permits, staff, etc."
          value={conciergeNotes}
          onChange={(e) => setConciergeNotes(e.target.value)}
        />

        <button
          className="h-10 rounded bg-black px-4 text-white disabled:opacity-50"
          onClick={submitConcierge}
          disabled={!orgId || conciergeUploading}
          title="Submit concierge request"
        >
          {concierge.request?.id ? "Update / Re-submit" : "Submit request"}
        </button>

        {concierge.request?.id ? (
          <div className="text-xs text-gray-500">
            Request ID: <span className="font-mono">{concierge.request.id}</span>
          </div>
        ) : null}
      </div>

      {/* Upload + Docs list */}
      <div className="space-y-3">
        <div className="text-sm font-semibold">2) Upload documents</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Doc type</label>
            <select
              className="h-10 rounded border px-3 text-sm"
              value={conciergeDocType}
              onChange={(e) => setConciergeDocType(e.target.value)}
            >
              <option value="license">License</option>
              <option value="insurance">Insurance</option>
              <option value="permit">Permit</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
          </div><input
            className="text-sm"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadConciergeDoc(f)
              // reset to allow re-upload same file
              ;(e.target as any).value = ""
            }}
            disabled={!concierge.request?.id || conciergeUploading}
          />

          <div className="text-xs text-gray-500">Allowed: pdf/png/jpg/txt</div>
        </div>

        <div className="mt-3">
  {concierge.documents.length === 0 ? (
    <div className="text-sm text-gray-500">No concierge documents uploaded yet.</div>
  ) : (
    <ul className="space-y-2">
      {concierge.documents.map((d) => (
        <li key={d.id} className="rounded border p-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{d.original_filename}</div>
            <div className="text-xs text-gray-500 mt-1">
              {d.doc_type} Â· {(d.size_bytes ?? 0)} bytes Â· {new Date(d.created_at).toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
            onClick={() => openConciergeDoc(d.id)}
          >
            Download
          </button>
        </li>
      ))}
    </ul>
  )}
</div>
        <button
  type="button"
  className="mt-3 rounded border px-3 py-1 text-xs hover:bg-gray-50"
  onClick={() => loadConcierge(orgId)}
>
  Refresh concierge
</button>
      </div>
    </div>
  )}
</section>

<div className="flex items-center gap-3">
    <div className="px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
      All Good â€” No upcoming expirations
    </div>
    <div className="text-sm text-gray-500">
      Monitoring Next 90 days
    </div>
  </div>
</div>
<div className="flex flex-col gap-2">

</div>
{err ? (
<div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
{err}
</div>
) : null}
{/* Apply success banner */}
      {applySuccess ? (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>{applySuccess}</div>
            {applySuccessOutside ? (
              <button
                className="rounded bg-black px-3 py-2 text-xs text-white"
                type="button"
                onClick={() => {
                  setDays(365)
                  loadItems(orgId, 365)
                }}
                title="Expand the window to see the new item"
              >
                Set window to 365 + Refresh
              </button>
            ) : null}
          </div>
        </div>
      ) : null}<section className="rounded-xl bg-white shadow-sm border border-gray-200 p-6 space-y-5">
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
              <div className="text-xs text-gray-500">
                Plan: <span className="font-medium">{(orgs.find(o => o.id === orgId)?.plan ?? "—")}</span>
                {" · "}
                Billing: <span className="font-medium">{(orgs.find(o => o.id === orgId)?.billing_status ?? "—")}</span>
                {" · "}
                Renews: <span className="font-medium">{(orgs.find(o => o.id === orgId)?.current_period_end ?? "—")}</span>
              </div>
              {showUpgrade ? (
  <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div>
      <div className="text-sm font-semibold text-blue-900">🔒 You're on Free Tracking</div>
      <div className="text-xs text-blue-900/80">
        Upgrade to automate reminders, export proof packs, and unlock insurance & subcontractor tracking.
      </div>
    </div>
    <div className="flex gap-2">
      <button
        className="h-10 rounded bg-blue-600 text-white px-4 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        onClick={() => goBilling("checkout")}
        disabled={!orgId}
        title="Start subscription"
      >
        Start free trial
      </button>
      <button
        className="h-10 rounded border border-blue-300 bg-white px-4 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
        onClick={() => goBilling("portal")}
        disabled={!orgId}
        title="Manage billing"
      >
        Manage billing
      </button>
    </div>
  </div>
) : null}
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
disabled={!orgId || scheduling || !isActive}
title={!isActive ? "Subscribe to enable reminders" : "Generate reminder events (deduped)"}
>
{scheduling ? "Scheduling..." : "Schedule reminders"}          </button>
<button
className="h-10 rounded border px-4 disabled:opacity-50"
onClick={() => {
if (!orgId) return
window.open(`/api/reminders?org_id=${orgId}&limit=50`, "_blank")
}}
disabled={!orgId || !isActive}
title={!isActive ? "Subscribe to view reminders" : "Open scheduled reminders (JSON)"}
>
View reminders
</button>
          <button
            className="h-10 rounded border px-4 disabled:opacity-50"
            onClick={() => goBilling("portal")}
            disabled={!orgId}
            title="Open Stripe customer portal"
          >
            Manage billing
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => {
              if (!orgId) return
              window.open(`/api/proof-pack/pdf?org_id=${orgId}`, "_blank")
            }}
            disabled={!orgId || !isActive}
            title={!isActive ? "Subscribe to export Proof Pack" : "Open Proof Pack export (PDF)"}
          >
            Proof Pack (PDF)
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/insurance" }}
            disabled={!orgId || !isActive}
            title={!isActive ? "Subscribe to unlock Insurance" : "Go to Insurance Tracking"}
          >
            Insurance
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/subcontractors" }}
            disabled={!orgId || !isActive}
            title={!isActive ? "Subscribe to unlock Subcontractors" : "Go to Subcontractors"}
          >
            Subcontractors
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => {
              if (!orgId) return
              window.open(`/api/proof-pack?org_id=${orgId}`, "_blank")
            }}
            disabled={!orgId}
            title={!isActive ? "Subscribe to export Proof Pack" : "Open Proof Pack export (JSON)"}
          >
            Proof Pack (JSON)
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/insurance" }}
            disabled={!orgId || !isActive}
            title={!isActive ? "Subscribe to unlock Insurance" : "Go to Insurance Tracking"}
          >
            Insurance
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/subcontractors" }}
            disabled={!orgId || !isActive}
            title={!isActive ? "Subscribe to unlock Subcontractors" : "Go to Subcontractors"}
          >
            Subcontractors
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/insurance" }}
            disabled={!orgId || !isActive}
            title={!isActive ? "Subscribe to unlock Insurance" : "Go to Insurance Tracking"}
          >
            Insurance
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/subcontractors" }}
            disabled={!orgId || !isActive}
            title={!isActive ? "Subscribe to unlock Subcontractors" : "Go to Subcontractors"}
          >
            Subcontractors
          </button>
<div className="text-sm text-gray-500 mt-1">
{selectedOrg ? (
<span className="font-mono">{selectedOrg.id}</span>
) : null}
</div>          {typeof lastScheduled === "number" ? (
<div className="text-xs text-gray-600">Scheduled: {lastScheduled}</div>
) : null}
</div>
</section>
<section className="grid gap-6 lg:grid-cols-3">
<div className="lg:col-span-2 rounded-lg border p-4 space-y-4 rs-card">
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
<div className="lg:col-span-1 rs-status-card rounded-lg border p-4 space-y-4 rs-card">
<div className="flex items-center justify-between">
<h2 className="text-lg font-semibold">Next {days} days</h2>
<span className="text-sm text-gray-500 mt-1">{items.length} item(s)</span>
</div>
{loadingItems ? (
<div className="text-sm text-gray-500 mt-1">Loading...</div>
) : items.length === 0 ? (
<div className="text-sm text-gray-500 mt-1"><div className="flex flex-col items-center justify-center h-full py-10 text-center space-y-4">
  <div className="text-5xl font-bold text-green-600">
    0
  </div>
  <div className="text-lg font-semibold">
    Upcoming Renewals
  </div>
  <div className="text-sm text-gray-500">
    You're clear for the Next 90 days.
  </div>
</div></div>
) : (
<ul className="space-y-3">
{items.map((it) => (
<li key={it.id} className="rounded border p-3">
<div className="flex items-start justify-between gap-3">
<div>
<div className="font-medium">{it.title}</div>
<div className="text-sm text-gray-500 mt-1">
<span className="font-mono">{it.type}</span>
{it.issuer ? <>  -  {it.issuer}</> : null}
{it.identifier ? <>  -  {it.identifier}</> : null}
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
Delete
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
Edit
</button>
<form
className="mt-2 flex flex-col gap-2"
action="/api/items/upload"
method="post"
encType="multipart/form-data"
target="_blank"
>
<input type="hidden" name="org_id" value={orgId} />
<input type="hidden" name="item_id" value={it.id} />
<input
className="text-xs"
type="file"
name="file"
accept=".pdf,.png,.jpg,.jpeg,.txt"
required
/>
<button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" type="submit">
Upload proof
</button>
</form>
<button
className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
onClick={() => {
if (!orgId) return
window.open(`/api/items/docs?org_id=${orgId}&item_id=${it.id}`, "_blank")
}}
title="Open item documents (JSON)"
>
View docs
</button>
<button
className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
onClick={() => {
if (!orgId) return
window.open(`/api/items/docs/summary?org_id=${orgId}&item_id=${it.id}`, "_blank")
}}
title="Open docs summary (JSON)"
>
Docs summary
</button>
<button
className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
onClick={async () => {
if (!orgId) return
const res = await fetch(`/api/items/docs/latest?org_id=${orgId}&item_id=${it.id}`, { cache: "no-store" })
const json = await res.json()
const docId = json?.document?.id
if (!docId) {
alert("No documents found for this item.")
return
}
window.open(`/api/items/doc-url?org_id=${orgId}&doc_id=${docId}&expires=600`, "_blank")
}}
title="Get signed download link for latest document"
>
Download latest
</button>
<button
className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
onClick={async () => {
if (!orgId) return
const ok = confirm("Delete the latest document for this item?")
if (!ok) return
const latestRes = await fetch(`/api/items/docs/latest?org_id=${orgId}&item_id=${it.id}`, { cache: "no-store" })
const latestJson = await latestRes.json()
const docId = latestJson?.document?.id
if (!docId) {
alert("No documents found for this item.")
return
}
const delRes = await fetch(`/api/items/docs/delete`, {
method: "DELETE",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ org_id: orgId, doc_id: docId }),
})
const delJson = await delRes.json()
if (!delJson?.ok) {
alert(delJson?.error ?? "Delete failed")
return
}
alert("Deleted latest document.")
}}
title="Delete latest document for this item"
>
Delete latest doc
</button>
</div>
</div>
<div className="mt-2 text-sm text-gray-700">
Expires: <span className="font-mono">{it.expires_on}</span>
{typeof it.renewal_window_days === "number" ? (
<>  -  Window: {it.renewal_window_days}d</>
) : null}
</div>
</li>
))}
</ul>
)}
</div>
</section>
{/* Requirements (Beta) */}
<section className="mt-10 rounded-lg border p-4 rs-card">
<h2 className="text-lg font-semibold">Setup Wizard (Requirements Library)</h2>
<p className="text-sm text-gray-500 mt-1">
Pick your state + trade, then add requirements into your tracking list.
</p>
<div className="mt-3 flex flex-wrap items-end gap-3">
<div className="flex flex-col">
<label className="text-xs text-gray-600">State</label>
<input
className="w-24 rounded border px-2 py-1"
value={reqState}
onChange={(e) => setReqState(e.target.value.toUpperCase())} onBlur={() => saveOrgProfile(reqState, reqTrade)}
placeholder="NH"
/>
</div>
<div className="flex flex-col">
<label className="text-xs text-gray-600">Trade</label>
<input
className="w-28 rounded border px-2 py-1"
value={reqTrade}
onChange={(e) => setReqTrade(e.target.value.toLowerCase())} onBlur={() => saveOrgProfile(reqState, reqTrade)}
placeholder="hvac"
/>
</div>
<button
className="rounded bg-black px-3 py-2 text-sm text-white"
onClick={loadRequirements}
disabled={reqLoading}
>
{reqLoading ? "Loading..." : "Load requirements"}
</button>

          <div className="text-sm text-gray-500 mt-1">
            Selected: {Object.values(selectedReqIds).filter(Boolean).length}
          </div>

          <button
            className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            type="button"
            disabled={Object.values(selectedReqIds).filter(Boolean).length === 0}
            onClick={() => {
  const firstId = Object.keys(selectedReqIds).find((id) => selectedReqIds[id]);
  if (!firstId) return;

  const row = requirements.find((r) => r.id === firstId);
  if (!row) return;

  applyRequirement(row.id, row.title);
}}
            title="Batch apply (next step)"
          >
            Add selected (next)
          </button>
        </div>

        {reqError ? (
<div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
{reqError}
</div>
) : null}
<div className="mt-3">
{requirements.length === 0 ? (
<div className="text-sm text-gray-500">No results yet.</div>
) : (
<ul className="space-y-2">
{requirements.map((r) => (
<li key={r.id} className="rounded border p-2">
  <div className="flex items-center justify-between gap-3">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={!!selectedReqIds[r.id]}
        onChange={(e) => setSelectedReqIds((prev) => ({ ...prev, [r.id]: e.target.checked }))}
      />
      <span className="font-medium">{r.title}</span>
    </label>
    <div className="flex items-center gap-2">
  <button
    className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
    type="button"
    onClick={() => applyRequirementToForm(r)}
    title="Use this requirement to prefill the create item form"
  >
    Use
  </button>
  <button
    className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
    type="button"
    disabled={!orgId}
    onClick={() => applyRequirement(r.id, r.title)}
    title="Add this requirement to tracking (creates a compliance item)"
  >
    Add
  </button>
</div>    <div className="text-xs text-gray-600">{r.state}  Â·  {r.trade}  Â·  {r.requirement_type}</div>  </div></li>
))}
</ul>
)}
</div>
</section>
{/* Apply Requirement Modal */}
      {applyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500 mt-1">Add to tracking</div>
                <div className="text-lg font-semibold">{applyTemplateTitle || "Requirement"}</div>
              </div>
              <button
                className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                type="button"
                onClick={() => setApplyOpen(false)}
                disabled={applySaving}
                title="Close"
              >
                
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">Expiry date</label>
              <input
                className="h-10 w-full rounded border px-3"
                type="date"
                value={applyExpiresOn}
                onChange={(e) => setApplyExpiresOn(e.target.value)}
              />
              <p className="text-xs text-gray-600">
                You can adjust renewal windows and docs later. This just creates the tracking item.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="h-10 rounded border px-4 text-sm hover:bg-gray-50 disabled:opacity-50"
                type="button"
                onClick={() => setApplyOpen(false)}
                disabled={applySaving}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded bg-black px-4 text-sm text-white disabled:opacity-50"
                type="button"
                onClick={confirmApplyRequirement}
                disabled={applySaving || !applyExpiresOn.trim()}
              >
                {applySaving ? "Adding..." : "Add to tracking"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
</main></div></div>
  </div></div>
)
}











































