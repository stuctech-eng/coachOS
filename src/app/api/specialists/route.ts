export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { bepaalCyclingLifecycle, bepaalRunningLifecycle } from '@/lib/specialists/lifecycle-engine'

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

// v2.4.83: running geactiveerd — tweede specialist, referentie-
// implementatie voor de "invuloefening"-belofte uit
// specialist-engine-architecture.md
const SPECIALIST_CONFIG: Record<string, { label: string; status: 'active' | 'development' }> = {
  cycling:  { label: 'Cycling Coach',  status: 'active' },
  running:  { label: 'Running Coach',  status: 'active' },
  rowing:   { label: 'Rowing Coach',   status: 'development' },
  strength: { label: 'Strength Coach', status: 'development' },
}

// v2.4.83: running toegevoegd — heeft nu een werkende Data Layer
const LIFECYCLE_ONDERSTEUND: Record<string, (userId: string, actief: boolean) => Promise<unknown>> = {
  cycling: bepaalCyclingLifecycle,
  running: bepaalRunningLifecycle,
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: profielen, error } = await supabase
      .from('specialist_profiles')
      .select('specialist_type, active, activated_at, preferences')
      .eq('user_id', user.id)

    if (error) throw error

    const profielMap = new Map((profielen || []).map(p => [p.specialist_type, p]))

    const specialisten = await Promise.all(
      Object.entries(SPECIALIST_CONFIG).map(async ([type, config]) => {
        const profiel = profielMap.get(type)
        const actief = profiel?.active ?? false

        let lifecycle = null
        const lifecycleFn = LIFECYCLE_ONDERSTEUND[type]
        if (lifecycleFn) {
          try {
            lifecycle = await lifecycleFn(user.id, actief)
          } catch (e) {
            console.error(`[specialists GET] lifecycle-berekening mislukt voor ${type}:`, e)
          }
        }

        return {
          specialist_type: type,
          label: config.label,
          beschikbaar: config.status === 'active',
          actief,
          activated_at: profiel?.activated_at ?? null,
          lifecycle,
        }
      })
    )

    return NextResponse.json({ specialisten })
  } catch (err) {
    console.error('[specialists GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const { specialist_type, active } = body

    if (typeof specialist_type !== 'string' || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'specialist_type (string) en active (boolean) zijn verplicht' }, { status: 400 })
    }

    const config = SPECIALIST_CONFIG[specialist_type]
    if (!config) {
      return NextResponse.json({ error: `Onbekende specialist_type: ${specialist_type}` }, { status: 400 })
    }
    if (active && config.status !== 'active') {
      return NextResponse.json({ error: `${config.label} is nog in ontwikkeling, kan nog niet geactiveerd worden` }, { status: 403 })
    }

    const supabase = createAdminClient()

    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      specialist_type,
      active,
    }
    if (active) upsertData.activated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('specialist_profiles')
      .upsert(upsertData, { onConflict: 'user_id,specialist_type' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, profiel: data })
  } catch (err) {
    console.error('[specialists POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
