"use client"
import { useEffect, useMemo, useState } from "react"
type Org = {
  id: string
  name: string
  created_at: string
  role: string
  profile_state?: string | null
  profile_trade?: string | null
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
const selectedOrg = useMemo(() => orgs.find(o => o.id === orgId), [orgs, orgId])


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
    if (orgId) loadItems(orgId, days)
    setApplySuccess("")
    setApplySuccessOutside(false)

    // Apply org profile defaults to wizard
    const org = orgs.find(o => o.id === orgId)
    if (org?.profile_state) setReqState(String(org.profile_state).toUpperCase())
    if (org?.profile_trade) setReqTrade(String(org.profile_trade).toLowerCase())

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])


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

  <div className="flex items-center gap-3">
    <div className="px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
      All Good — No upcoming expirations
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
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => {
              if (!orgId) return
              window.open(`/api/proof-pack/pdf?org_id=${orgId}`, "_blank")
            }}
            disabled={!orgId}
            title="Open Proof Pack export (PDF)"
          >
            Proof Pack (PDF)
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/insurance" }}
            disabled={!orgId}
            title="Go to Insurance Tracking"
          >
            Insurance
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/subcontractors" }}
            disabled={!orgId}
            title="Go to Subcontractors"
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
            title="Open Proof Pack export (JSON)"
          >
            Proof Pack (JSON)
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/insurance" }}
            disabled={!orgId}
            title="Go to Insurance Tracking"
          >
            Insurance
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/subcontractors" }}
            disabled={!orgId}
            title="Go to Subcontractors"
          >
            Subcontractors
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/insurance" }}
            disabled={!orgId}
            title="Go to Insurance Tracking"
          >
            Insurance
          </button>
          <button
            className="h-10 rounded border px-4 text-sm"
            onClick={() => { window.location.href = "/subcontractors" }}
            disabled={!orgId}
            title="Go to Subcontractors"
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
</div>    <div className="text-xs text-gray-600">{r.state}  ·  {r.trade}  ·  {r.requirement_type}</div>  </div></li>
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




















