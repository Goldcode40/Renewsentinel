import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Required filters (starting narrow)
  const state = (searchParams.get("state") || "").toUpperCase().trim(); // e.g. NH
  const trade = (searchParams.get("trade") || "").toLowerCase().trim(); // e.g. hvac

  // Optional
  const requirement_type = (searchParams.get("type") || "").toLowerCase().trim(); // license/insurance/permit/cert

  if (!state || !trade) {
    return NextResponse.json(
      { error: "Missing required query params: state, trade" },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json(
      { error: "Server misconfigured: missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anon);

  let query = supabase
    .from("requirements_catalog")
    .select(
      "id,country,state,trade,requirement_type,title,issuer,source_url,description,default_renewal_window_days,default_reminder_offsets_days,required_docs,is_active,created_at,updated_at"
    )
    .eq("state", state)
    .eq("trade", trade)
    .eq("is_active", true)
    .order("title", { ascending: true });

  if (requirement_type) {
    query = query.eq("requirement_type", requirement_type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message, details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({ rows: data ?? [] });
}
