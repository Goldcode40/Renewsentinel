import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

type Body = {
  id?: string
  org_id?: string
}

export async function DELETE(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as Body

    const id = (body.id ?? "").trim()
    const orgId = (body.org_id ?? "").trim()

    if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 })
    if (!orgId) return Response.json({ ok: false, error: "Missing org_id" }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from("compliance_items")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id")
      .single()

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!data) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return Response.json({ ok: true, deleted: data })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 })
  }
}
