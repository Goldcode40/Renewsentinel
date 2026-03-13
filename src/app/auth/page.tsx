"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function AuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signup")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")

    try {
      if (!email.trim()) throw new Error("Email is required")
      if (!password.trim()) throw new Error("Password is required")

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (error) throw error
        setMessage("Signup submitted. Check your email if confirmation is enabled, then sign in.")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error

        window.location.href = "/dashboard-premium"
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-8 shadow-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">RenewSentinel</h1>
          <p className="mt-2 text-sm text-slate-700">
            Sign up or sign in to access your compliance dashboard.
          </p>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              mode === "signup" ? "bg-slate-900 text-white" : "bg-white/10 text-slate-900"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              mode === "signin" ? "bg-slate-900 text-white" : "bg-white/10 text-slate-900"
            }`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-700">Email</label>
            <input
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  style={{ backgroundColor: "#ffffff", color: "#000000", border: "2px solid #000000", padding: "12px 16px", width: "100%", borderRadius: "8px" }}
  placeholder="you@company.com"
/>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-700">Password</label>
            <input
  type="text"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  style={{ backgroundColor: "#ffffff", color: "#000000", border: "2px solid #000000", padding: "12px 16px", width: "100%", borderRadius: "8px" }}
  placeholder="Enter password"
/>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        {message ? <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          <p>
            By continuing, you agree to the{" "}
            <Link href="/terms" className="underline hover:text-slate-700">Terms</Link>,{" "}
            <Link href="/privacy" className="underline hover:text-slate-700">Privacy Policy</Link>, and{" "}
            <Link href="/disclaimer" className="underline hover:text-slate-700">Disclaimer</Link>.
          </p>
        </div>
      </div>
    </main>
  )
}






