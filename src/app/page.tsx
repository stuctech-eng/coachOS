import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

export default async function RootPage() {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login')
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')
  redirect('/home')
}
