import Link from "next/link"

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">RenewSentinel</h1>
      <p className="mt-4 text-xl">License & Cert Renewal Tracker</p>
      <p className="mt-8">Supabase connected</p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
        <Link href="/terms" className="hover:underline">Terms</Link>
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <Link href="/disclaimer" className="hover:underline">Disclaimer</Link>
      </div>
    </main>
  )
}
