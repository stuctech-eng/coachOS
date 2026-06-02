export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const supabase = createAdminClient()

    // Alleen toegestane velden updaten
    const update: Record<string, unknown> = {}
    if (body.first_name !== undefined)       update.first_name       = body.first_name
    if (body.display_name !== undefined)     update.display_name     = body.display_name
    if (body.age !== undefined)              update.age              = body.age ? Number(body.age) : null
    if (body.height !== undefined)           update.height           = body.height ? Number(body.height) : null
    if (body.weight !== undefined)           update.weight           = body.weight ? Number(body.weight) : null
    if (body.gender !== undefined)           update.gender           = body.gender
    if (body.experience_level !== undefined) update.experience_level = body.experience_level
    if (body.available_time !== undefined)   update.available_time   = body.available_time
    if (body.injury_history !== undefined)   update.injury_history   = body.injury_history

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Geen velden om te updaten' }, { status: 400 })
    }

    update.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ profile: data })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Updaten mislukt' }, { status: 500 })
  }
}
