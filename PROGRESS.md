# RenewSentinel Progress Log

## 2026-02-20

### Phase 2.2 — Compliance Items (Tracking)
- CRUD endpoints: create, list, next-days, update, delete ✅
- Dashboard UI: create, refresh, edit title, delete ✅

### Phase 2.3 — Reminders (Foundation)
- reminder_events table + migration applied ✅
- POST /api/reminders/schedule (dedupe) ✅
- GET /api/reminders (list) ✅
- Dashboard: Schedule reminders + View reminders ✅
- scripts/send_reminders_stub.mjs marks reminders sent ✅
- npm script: reminders:send ✅

### Phase 2.4 — Document Storage (Proof)
- item_documents table migration applied ✅
- item-docs storage bucket created via migration ✅
- POST /api/items/upload (storage + db) ✅
- GET /api/items/docs (list) ✅
- GET /api/items/docs/latest ✅
- GET /api/items/docs/summary ✅
- GET /api/items/doc-url (signed URL) ✅
- DELETE /api/items/docs/delete (storage + db) ✅
- Dashboard: Upload proof, View docs, Docs summary, Download latest, Delete latest doc ✅

## 2026-02-21

### Phase 3.1 — Requirements Database (Starting Narrow)
- requirements_catalog table + index + seed row (NH / hvac / license) ✅
- GET /api/requirements?state=NH&trade=hvac (read-only) ✅
- Dashboard: Requirements (Beta) panel loads and displays results ✅

### Phase 3.2 — Guided Setup Wizard (Done-for-you-ish)
- Dashboard: “Use” button on a requirement prefills Create compliance item form ✅
  - Prefills: type, title, issuer, renewal window ✅
  - Expires date left for user to set ✅

### Phase 4.1 — Proof Pack Export (1-click) [IN PROGRESS]
- proof_pack_exports table (stub) ✅
- GET /api/proof-pack?org_id=... returns Proof Pack JSON ✅
- Proof Pack includes latest_doc_signed_url for quick downloads ✅
- Dashboard: Proof Pack (JSON) button opens export ✅
