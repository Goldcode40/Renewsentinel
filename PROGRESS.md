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
