import { supabase } from '@/lib/supabase'

export default async function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center p-24'>
      <h1 className='text-4xl font-bold'>RenewSentinel</h1>
      <p className='mt-4 text-xl'>License & Cert Renewal Tracker</p>
      <p className='mt-8'>Supabase connected</p>
    </main>
  )
}
