import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireActiveOrTrial } from "@/lib/billingGate";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// POST /api/concierge/upload
// form-data fields:
// - org_id (uuid) [required]
// - request_id (uuid) [required]
// - doc_type (string) [optional] e.g. license|insurance|cert|other
// - file (File) [required]
export async function POST(req: NextRequest) {
  try {
    const supabase = sb();
    const form = await req.formData();

    const org_id = String(form.get("org_id") || "").trim();

    if (!org_id) return NextResponse.json({ ok: false, error: "org_id required" }, { status: 400 });

    // HARD GATE: Concierge Upload is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(supabase as any, org_id);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required", reason: gate.reason, org: gate.org ?? null },
        { status: 403 }
      );
    }

    const request_id = String(form.get("request_id") || "").trim();
    const doc_type = String(form.get("doc_type") || "other").trim() || "other";
    const file = form.get("file");

    if (!request_id) return NextResponse.json({ ok: false, error: "request_id required" }, { status: 400 });
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
    }

    // Verify request belongs to org (basic safety)
    const { data: reqRow, error: reqErr } = await supabase
      .from("concierge_requests")
      .select("id, org_id")
      .eq("id", request_id)
      .maybeSingle();

    if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 500 });
    if (!reqRow) return NextResponse.json({ ok: false, error: "request not found" }, { status: 404 });
    if (reqRow.org_id !== org_id) return NextResponse.json({ ok: false, error: "request/org mismatch" }, { status: 400 });

    const bucket = "concierge-docs";

    // Ensure bucket exists (service-role only). Ignore "already exists" failures.
    try {
      await supabase.storage.createBucket(bucket, { public: false });
    } catch {
      // noop
    }

    const original = file.name || "upload";
    const safeName = original.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `${org_id}/${request_id}/${ts}_${safeName}`;

    // Upload to storage
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    // Insert DB row
    const { data: docRow, error: insErr } = await supabase
      .from("concierge_documents")
      .insert({
        request_id,
        doc_type,
        bucket,
        path: storagePath,
        original_filename: original,
        mime_type: file.type || null,
        size_bytes: typeof file.size === "number" ? file.size : null,
        uploaded_by: null,
      })
      .select("*")
      .single();

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, document: docRow }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
