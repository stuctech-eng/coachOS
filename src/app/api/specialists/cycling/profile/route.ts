export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { berekenVermogensZones, berekenHartslagZones } from '@/lib/specialists/cycling-zones'

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

// ── Cycling Profile — Fase 1, Cycling Foundation ────────────────────────
// Bron: docs/cycling-specialist-roadmap-v1.md. Slaat GEEN nieuwe tabel op
// — hergebruikt specialist_profiles.preferences (bestond al, gebruikt
// door de Coach Layer-routes). Gewicht/lengte/rusthartslag/
// ervaringsniveau worden hier BEWUST niet opgeslagen — die bestaan al op
// profiles/health_metrics, dit blijft de enige bron van waarheid.

interface CyclingPreferences {
  ftp?: number
  max_hartslag?: number
  heeft_vermogensmeter?: boolean
  heeft_hartslagmeter?: boolean
  heeft_cadanssensor?: boolean
  heeft_smarttrainer?: boolean
  heeft_zwift?: boolean
  trainingsdagen?: string[] // bijv. ['maandag', 'woensdag', 'zaterdag']
  beschikbare_uren_per_week?: number
}

const GELDIGE_DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .eq('specialist_type', 'cycling')
      .maybeSingle()

    const prefs: CyclingPreferences = data?.preferences || {}

    return NextResponse.json({
      profiel: prefs,
      // v2.4.91: zones direct meegeleverd, alleen als de benodigde
      // waarde daadwerkelijk is ingevuld — geen zones tonen op basis van
      // een default/gegokte FTP
      vermogenszones: prefs.ftp ? berekenVermogensZones(prefs.ftp) : null,
      hartslagzones: prefs.max_hartslag ? berekenHartslagZones(prefs.max_hartslag) : null,
    })
  } catch (err) {
    console.error('[specialists/cycling/profile GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await req.json()

    // ── Validatie, geen stille foute data toestaan ─────────────────────
    const nieuw: CyclingPreferences = {}
    if (body.ftp !== undefined) {
      if (typeof body.ftp !== 'number' || body.ftp <= 0 || body.ftp > 600) {
        return NextResponse.json({ error: 'FTP moet een getal tussen 1 en 600 watt zijn' }, { status: 400 })
      }
      nieuw.ftp = body.ftp
    }
    if (body.max_hartslag !== undefined) {
      if (typeof body.max_hartslag !== 'number' || body.max_hartslag <= 0 || body.max_hartslag > 250) {
        return NextResponse.json({ error: 'Max hartslag moet een getal tussen 1 en 250 zijn' }, { status: 400 })
      }
      nieuw.max_hartslag = body.max_hartslag
    }
    for (const veld of ['heeft_vermogensmeter', 'heeft_hartslagmeter', 'heeft_cadanssensor', 'heeft_smarttrainer', 'heeft_zwift'] as const) {
      if (body[veld] !== undefined) {
        if (typeof body[veld] !== 'boolean') {
          return NextResponse.json({ error: `${veld} moet true/false zijn` }, { status: 400 })
        }
        nieuw[veld] = body[veld]
      }
    }
    if (body.trainingsdagen !== undefined) {
      if (!Array.isArray(body.trainingsdagen) || !body.trainingsdagen.every((d: unknown) => GELDIGE_DAGEN.includes(d as string))) {
        return NextResponse.json({ error: `trainingsdagen moet een lijst zijn uit: ${GELDIGE_DAGEN.join(', ')}` }, { status: 400 })
      }
      nieuw.trainingsdagen = body.trainingsdagen
    }
    if (body.beschikbare_uren_per_week !== undefined) {
      if (typeof body.beschikbare_uren_per_week !== 'number' || body.beschikbare_uren_per_week < 0 || body.beschikbare_uren_per_week > 40) {
        return NextResponse.json({ error: 'Beschikbare uren per week moet tussen 0 en 40 zijn' }, { status: 400 })
      }
      nieuw.beschikbare_uren_per_week = body.beschikbare_uren_per_week
    }

    // ── Bestaande preferences ophalen en samenvoegen, niet overschrijven ──
    const { data: bestaand } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .eq('specialist_type', 'cycling')
      .maybeSingle()

    const samengevoegd = { ...(bestaand?.preferences || {}), ...nieuw }

    const { error } = await supabase
      .from('specialist_profiles')
      .upsert({
        user_id: user.id,
        specialist_type: 'cycling',
        preferences: samengevoegd,
      }, { onConflict: 'user_id,specialist_type' })

    if (error) throw error

    return NextResponse.json({
      profiel: samengevoegd,
      vermogenszones: samengevoegd.ftp ? berekenVermogensZones(samengevoegd.ftp) : null,
      hartslagzones: samengevoegd.max_hartslag ? berekenHartslagZones(samengevoegd.max_hartslag) : null,
    })
  } catch (err) {
    console.error('[specialists/cycling/profile PUT]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
