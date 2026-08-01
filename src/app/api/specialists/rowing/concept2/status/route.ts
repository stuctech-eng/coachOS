export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// v2.4.218 (Rowing Platform Fase 1): laat de UI weten of Concept2 al
// gekoppeld is — geeft NOOIT de token zelf terug, alleen of er een
// verbinding bestaat en sinds wanneer.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('concept2_tokens')
      .select('connected_at')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({ verbonden: !!data, connected_at: data?.connected_at ?? null })
  } catch (err) {
    console.error('[concept2/status]', err)
    return NextResponse.json({ verbonden: false })
  }
}
