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

// ── Kettlebell Profile — Fase 0 + MVP1 ──────────────────────────────────
// Bron: Kettlebell Specialist Master Plan + gebruikersverduidelijking
// (22 augustus 2026) over de twee trainingsmodi:
// - 'fitness'  → gebruikt de bestaande Trainer AI + kettlebell-exercises.ts
//                (algemene kracht/conditie/mobiliteit), ONGEWIJZIGD
// - 'sport'    → gebruikt deze nieuwe Kettlebell Specialist (Girevoy
//                Sport: Jerk/Snatch/Long Cycle/Biathlon)
// federatie_voorkeur is puur een NAAM-voorkeur (welke regelset de
// gebruiker wil volgen zodra die bestaat) — bevat GEEN normen/regels.
// Classificatie/promotie tegen deze federatie volgt pas in MVP2, zodra
// een officiële bron is aangeleverd (WKSF eerst, zie architectuurdoc).

type KettlebellModus = 'fitness' | 'sport'

interface KettlebellPreferences {
  modus?: KettlebellModus
  primaire_discipline?: 'jerk' | 'snatch' | 'long_cycle' | 'biathlon' | 'one_arm_long_cycle'
  federatie_voorkeur?: 'wksf' | 'iukl' | 'gsu' | 'geen'
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .eq('specialist_type', 'kettlebell')
      .maybeSingle()
    return NextResponse.json({ preferences: (data?.preferences || {}) as KettlebellPreferences })
  } catch (err) {
    console.error('[kettlebell/profile GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json() as KettlebellPreferences
    const supabase = createAdminClient()

    const { error } = await supabase.from('specialist_profiles').upsert({
      user_id: user.id,
      specialist_type: 'kettlebell',
      active: true,
      preferences: {
        modus: body.modus || 'fitness',
        primaire_discipline: body.primaire_discipline || undefined,
        federatie_voorkeur: body.federatie_voorkeur || 'geen',
      },
    }, { onConflict: 'user_id,specialist_type' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[kettlebell/profile POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
