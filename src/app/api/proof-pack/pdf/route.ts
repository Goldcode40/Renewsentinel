import { getSupabaseAdmin } from "@/lib/supabaseAdmin"
import { PDFDocument, StandardFonts } from "pdf-lib"

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)

    const orgId = (url.searchParams.get("org_id") ?? "").trim()
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

    // latest doc per item
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

      const expiresIn = 600
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
    const page = pdfDoc.addPage([612, 792]) // US Letter
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const margin = 40
    let y = 792 - margin

    const draw = (text: string, size = 11, bold = false) => {
      page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font })
      y -= size + 6
    }

    draw("RenewSentinel Proof Pack (v0)", 16, true)
    draw(`Org: ${orgRes.data.name} (${orgRes.data.id})`, 10)
    draw(`Generated: ${new Date().toISOString()}`, 10)
    y -= 8

    draw(`Items: ${items.length} (with latest doc: ${Object.keys(latestDocsByItem).length})`, 11, true)
    y -= 6

    // Items list (simple; wraps by truncation)
    for (const it of items) {
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
        draw(`Signed URL (10m): ${docUrl ?? "null"}`, 8)
      } else {
        draw("Latest doc: none", 10)
      }

      y -= 8
      if (y < 120) {
        // start a new page if we're running low
        y = 792 - margin
        pdfDoc.addPage([612, 792])
      }
    }

    const pdfBytes = await pdfDoc.save()

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proof-pack-${orgId}.pdf"`,
      },
    })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
