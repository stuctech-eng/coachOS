import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

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

// GET — haal bestaande API key op
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('health_api_keys')
      .select('key, created_at')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    return NextResponse.json({ key: data?.key || null })
  } catch {
    return NextResponse.json({ key: null })
  }
}

// POST — genereer nieuwe API key
export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    // Deactiveer oude keys
    await supabase
      .from('health_api_keys')
      .update({ active: false })
      .eq('user_id', user.id)

    // Genereer nieuwe key
    const key = 'coak_' + randomBytes(24).toString('hex')

    await supabase.from('health_api_keys').insert({
      user_id: user.id,
      key,
      active: true,
    })

    return NextResponse.json({ key })
  } catch (error) {
    console.error('API key fout:', error)
    return NextResponse.json({ error: 'Genereren mislukt' }, { status: 500 })
  }
}
