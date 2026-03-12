import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireActiveOrTrial } from "@/lib/billingGate"

export const dynamic = "force-dynamic"

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error("Missing Supabase env vars")
  return createClient(url, service, { auth: { persistSession: false } })
}

// GET /api/concierge/doc-url?org_id=...&doc_id=...&expires=600
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get("org_id") || ""
    const doc_id = searchParams.get("doc_id") || ""
    const expires = Number(searchParams.get("expires") || "600")

    if (!org_id) return NextResponse.json({ ok: false, error: "org_id is required" }, { status: 400 })
    if (!doc_id) return NextResponse.json({ ok: false, error: "doc_id is required" }, { status: 400 })

    const sb = supabaseAdmin()

    // HARD GATE: Concierge Doc URL is premium-only (active subscription OR active trial)
    const gate = await requireActiveOrTrial(sb as any, org_id)
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: "Upgrade required" },
        { status: 403 }
      )
    }


    // 1) Load document row
    const docRes = await sb
      .from("concierge_documents")
      .select("id, request_id, bucket, path, original_filename, mime_type, size_bytes, created_at")
      .eq("id", doc_id)
      .single()

    if (docRes.error || !docRes.data) {
      return NextResponse.json({ ok: false, error: docRes.error?.message || "Document not found" }, { status: 404 })
    }

    // 2) Ensure the document belongs to a request in this org
    const reqRes = await sb
      .from("concierge_requests")
      .select("id, org_id")
      .eq("id", docRes.data.request_id)
      .single()

    if (reqRes.error || !reqRes.data) {
      return NextResponse.json({ ok: false, error: reqRes.error?.message || "Request not found" }, { status: 404 })
    }

    if (reqRes.data.org_id !== org_id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    // 3) Signed URL from storage
    const bucket = docRes.data.bucket || "concierge-docs"
    const path = docRes.data.path

    const signed = await sb.storage.from(bucket).createSignedUrl(path, expires)
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ ok: false, error: signed.error?.message || "Failed to sign url" }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      url: signed.data.signedUrl,
      doc: docRes.data,
      expires,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 })
  }
}

