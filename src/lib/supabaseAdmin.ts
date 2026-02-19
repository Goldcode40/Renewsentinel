import { createClient } from "@supabase/supabase-js"

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in env")
  if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env")

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  })
}
