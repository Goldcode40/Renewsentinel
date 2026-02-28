import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function headTail(s: string, n = 3) {
  if (!s) return "";
  if (s.length <= n * 2) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

export async function POST(req: NextRequest) {
  try {
    const expectedRaw = process.env.CONCIERGE_ADMIN_TOKEN ?? "";
    const expected = expectedRaw.trim();

    const providedRaw = req.headers.get("x-admin-token") ?? "";
    const provided = providedRaw.trim();

    const debug = req.nextUrl.searchParams.get("debug") === "1";

    if (!expected || provided !== expected) {
      // Safe debug details (no full token exposure)
      if (debug && process.env.NODE_ENV !== "production") {
        return NextResponse.json(
          {
            error: "forbidden",
            debug: {
              nodeEnv: process.env.NODE_ENV ?? "",
              hasEnv: Boolean(expected),
              envLen: expected.length,
              envHeadTail: headTail(expected),
              providedLen: provided.length,
              providedHeadTail: headTail(provided),
              headerPresent: Boolean(providedRaw),
            },
          },
          { status: 403 }
        );
      }

      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const bodyUnknown: unknown = await req.json();
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;

    const request_id = typeof body.request_id === "string" ? body.request_id.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";

    if (!request_id) return NextResponse.json({ error: "request_id required" }, { status: 400 });
    if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

    const allowed = new Set(["not_started", "submitted", "in_review", "completed", "rejected"]);
    if (!allowed.has(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const patch: Record<string, unknown> = { status };
    if (status === "completed") patch.completed_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("concierge_requests")
      .update(patch)
      .eq("id", request_id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, request: data }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
