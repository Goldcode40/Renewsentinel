import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { PDFDocument, StandardFonts } from "pdf-lib"
import QRCode from "qrcode"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)

    const orgId = (url.searchParams.get("org_id") ?? "").trim()
    const downloadParam = (url.searchParams.get("download") ?? "").trim()
    const asAttachment = downloadParam === "1" || downloadParam.toLowerCase() === "true"
    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    // org
    const orgRes = await supabaseAdmin
      .from("organizations")
      .select("id, name, created_at")
      .eq("id", orgId)
      .maybeSingle()

    if (orgRes.error) return Response.json({ ok: false, error: orgRes.error.message }, { status: 500 })
    if (!orgRes.data) return Response.json({ ok: false, error: "Org not found" }, { status: 404 })

    // items
    const itemsRes = await supabaseAdmin
      .from("compliance_items")
      .select("id, org_id, type, title, issuer, identifier, expires_on, renewal_window_days, status, created_at, updated_at")
      .eq("org_id", orgId)
      .order("expires_on", { ascending: true })

    if (itemsRes.error) return Response.json({ ok: false, error: itemsRes.error.message }, { status: 500 })

    const items = itemsRes.data ?? []
    const itemIds = items.map((i) => i.id)

    // insurance
    const insRes = await supabaseAdmin
      .from("insurance_policies")
      .select("id, org_id, provider, policy_number, policy_type, effective_date, expiry_date, coverage_amount, created_at, updated_at")
      .eq("org_id", orgId)
      .order("expiry_date", { ascending: true })

    if (insRes.error) return Response.json({ ok: false, error: insRes.error.message }, { status: 500 })
    const policies = insRes.data ?? []

    // subcontractors
    const subsRes = await supabaseAdmin
      .from("subcontractors")
      .select("id, org_id, name, contact_name, email, phone, trade, is_active, created_at, updated_at")
      .eq("org_id", orgId)
      .order("name", { ascending: true })

    if (subsRes.error) return Response.json({ ok: false, error: subsRes.error.message }, { status: 500 })
    const subcontractors = subsRes.data ?? []
    const subIds = subcontractors.map((s) => s.id)

    // subcontractor docs
    let subDocs: any[] = []
    if (subIds.length > 0) {
      const docsRes = await supabaseAdmin
        .from("subcontractor_documents")
        .select("id, org_id, subcontractor_id, doc_type, title, expires_on, filename, content_type, size_bytes, storage_bucket, storage_path, created_at, updated_at")
        .eq("org_id", orgId)
        .in("subcontractor_id", subIds)
        .order("created_at", { ascending: false })

      if (docsRes.error) return Response.json({ ok: false, error: docsRes.error.message }, { status: 500 })
      subDocs = docsRes.data ?? []
    }

    const docsBySub: Record<string, any[]> = {}
    for (const d of subDocs) {
      const sid = String(d.subcontractor_id ?? "")
      if (!docsBySub[sid]) docsBySub[sid] = []
      docsBySub[sid].push(d)
    }

    // Signed URLs for subcontractor docs (10 minutes)
    const subDocUrlById: Record<string, string | null> = {}
    const expiresIn = 600
    for (const d of subDocs) {
      if (!d?.storage_bucket || !d?.storage_path) {
        subDocUrlById[String(d.id)] = null
        continue
      }
      const { data, error } = await supabaseAdmin.storage
        .from(d.storage_bucket)
        .createSignedUrl(d.storage_path, expiresIn)

      if (error) {
        subDocUrlById[String(d.id)] = null
        continue
      }
      subDocUrlById[String(d.id)] = data?.signedUrl ?? null
    }

    // latest doc per compliance item
    const latestDocsByItem: Record<string, any> = {}
    const latestDocUrlByItem: Record<string, string | null> = {}

    if (itemIds.length > 0) {
      const docsRes = await supabaseAdmin
        .from("item_documents")
        .select("id, org_id, item_id, filename, content_type, size_bytes, storage_bucket, storage_path, created_at")
        .eq("org_id", orgId)
        .in("item_id", itemIds)
        .order("created_at", { ascending: false })

      if (docsRes.error) return Response.json({ ok: false, error: docsRes.error.message }, { status: 500 })

      for (const d of docsRes.data ?? []) {
        if (!latestDocsByItem[d.item_id]) latestDocsByItem[d.item_id] = d
      }

      for (const itemId of Object.keys(latestDocsByItem)) {
        const doc = latestDocsByItem[itemId]
        if (!doc?.storage_bucket || !doc?.storage_path) {
          latestDocUrlByItem[itemId] = null
          continue
        }

        const { data, error } = await supabaseAdmin.storage
          .from(doc.storage_bucket)
          .createSignedUrl(doc.storage_path, expiresIn)

        if (error) {
          latestDocUrlByItem[itemId] = null
          continue
        }

        latestDocUrlByItem[itemId] = data?.signedUrl ?? null
      }
    }

    // --- Build PDF ---
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([612, 792]) // US Letter
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    async function drawQrOn(p: any, qrUrl: string, x: number, yTop: number, size: number) {
      const dataUrl = await QRCode.toDataURL(qrUrl, { margin: 0, width: 200 })
      const base64 = dataUrl.split(",")[1]
      const bytes = Buffer.from(base64, "base64")
      const img = await pdfDoc.embedPng(bytes)
      p.drawImage(img, { x, y: yTop - size, width: size, height: size })
    }

    const margin = 40
    let y = 792 - margin

    const draw = (text: string, size = 11, bold = false) => {
      page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font })
      y -= size + 6
    }
    function ensureSpace(minY: number) {
      if (y < minY) {
        y = 792 - margin
        page = pdfDoc.addPage([612, 792])
      }
    }

    draw("RenewSentinel Proof Pack (v0)", 16, true)
    draw(`Org: ${orgRes.data.name} (${orgRes.data.id})`, 10)
    draw(`Generated: ${new Date().toISOString()}`, 10)
    y -= 8

    draw(`Items: ${items.length} (with latest doc: ${Object.keys(latestDocsByItem).length})`, 11, true)
    draw(`Insurance policies: ${policies.length}`, 11, true)
    draw(`Subcontractors: ${subcontractors.length} (docs: ${subDocs.length})`, 11, true)
    y -= 10

    // --- Insurance section ---
    draw("Insurance Policies", 14, true)
    y -= 4
    if (policies.length === 0) {
      draw("None", 11)
      y -= 8
    } else {
      for (const p of policies) {
        ensureSpace(160)
        const provider = p.provider ?? ""
        const type = p.policy_type ?? ""
        const num = p.policy_number ?? ""
        const eff = p.effective_date ?? ""
        const exp = p.expiry_date ?? ""
        const cov = typeof p.coverage_amount === "number" ? String(p.coverage_amount) : ""
        draw(`${type} | ${provider}`, 12, true)
        draw(`Policy #: ${num || "-"}   Coverage: ${cov || "-"}`, 10)
        draw(`Effective: ${eff || "-"}   Expiry: ${exp || "-"}`, 10)
        y -= 8
      }
    }

    // --- Subcontractors section (with QR for docs) ---
    y -= 6
    draw("Subcontractors", 14, true)
    y -= 4

    if (subcontractors.length === 0) {
      draw("None", 11)
      y -= 8
    } else {
      for (const s of subcontractors) {
        ensureSpace(200)
        draw(`${s.name ?? ""}${s.trade ? ` (${s.trade})` : ""}`, 12, true)
        draw(`Contact: ${s.contact_name ?? "-"}   Email: ${s.email ?? "-"}   Phone: ${s.phone ?? "-"}`, 9)
        draw(`Active: ${s.is_active ? "Yes" : "No"}`, 9)

        const docs = docsBySub[String(s.id)] ?? []
        if (docs.length === 0) {
          draw("Docs: none", 9)
          y -= 8
        } else {
          draw(`Docs: ${docs.length}`, 9, true)
          for (const d of docs) {
            ensureSpace(160)

            const line = `- ${d.doc_type ?? ""} | ${d.title ?? "-"} | Expires: ${d.expires_on ?? "-"}`
            draw(line, 9, false)

            const file = d.filename ?? ""
            if (file) draw(`  File: ${file}`, 8)

            const signed = subDocUrlById[String(d.id)]
            if (signed) {
              // Put QR on the right side
              await drawQrOn(page, signed, 520, y + 55, 60)
              draw("  QR: scan to download (10m)", 8)
            } else {
              draw("  QR: none", 8)
            }

            y -= 6
          }
          y -= 6
        }

        y -= 6
      }
    }

    // --- Compliance Items ---
    y -= 4
    draw("Compliance Items", 14, true)
    y -= 4

    for (const it of items) {
      ensureSpace(180)
      const expires = it.expires_on ?? ""
      const issuer = it.issuer ?? ""
      const ident = it.identifier ?? ""
      const status = it.status ?? ""

      const header = `${it.type ?? ""} | ${it.title ?? ""}`
      draw(header.length > 90 ? header.slice(0, 87) + "..." : header, 12, true)
      draw(`Issuer: ${issuer}   Identifier: ${ident}`, 10)
      draw(`Expires: ${expires}   Status: ${status}   Renewal window: ${it.renewal_window_days ?? ""} days`, 10)

      const doc = latestDocsByItem[it.id]
      const docUrl = latestDocUrlByItem[it.id]
      if (doc) {
        draw(`Latest doc: ${doc.filename} (${doc.content_type ?? "unknown"})`, 10)
        if (docUrl) {
          await drawQrOn(page, docUrl, 520, y + 40, 70)
          draw(`QR: scan to download (10m)`, 8)
        } else {
          draw(`QR: none`, 8)
        }
      } else {
        draw("Latest doc: none", 10)
      }

      y -= 8
      if (y < 120) {
        y = 792 - margin
        page = pdfDoc.addPage([612, 792])
      }
    }

    const pdfBytes = await pdfDoc.save()

    // Audit log (best effort)
    try {
      await supabaseAdmin.from("audit_log_events").insert({
        org_id: orgId,
        actor_user_id: "00000000-0000-0000-0000-000000000001",
        actor_role: "owner",
        action: "proofpack.exported.pdf",
        entity_type: "proof_pack",
        entity_id: null,
        details: {
          total_items: items.length,
          total_insurance_policies: policies.length,
          total_subcontractors: subcontractors.length,
          total_subcontractor_documents: subDocs.length,
        },
      })
    } catch (_) {}

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename="proof-pack-${orgId}.pdf"`,
      },
    })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}