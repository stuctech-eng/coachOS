export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { berekenVDOT, berekenPaceZones } from '@/lib/specialists/running-zones'
import { berekenHartslagZones } from '@/lib/specialists/cycling-zones'

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

// ── Running Profile — Roadmap v1.0, Fase 1 ──────────────────────────────
// Bron: overleg 19 juli 2026. Slaat GEEN nieuwe tabel op — hergebruikt
// specialist_profiles.preferences (specialist_type='running'), exact
// hetzelfde patroon als Cycling. Gewicht/lengte/rusthartslag/
// ervaringsniveau BEWUST niet hier opgeslagen — bestaan al op
// profiles/health_metrics.
//
// Ontwerpbeslissing (vastgelegd in de roadmap): trainingsdagen/
// beschikbare uren zijn APART van Cycling — iemand kan andere dagen
// fietsen dan hardlopen.
//
// VDOT wordt niet los ingevoerd, maar afgeleid uit een recente
// wedstrijdprestatie (afstand + tijd) — dat is de correcte, in de
// Daniels-methode gebruikelijke manier (net zoals FTP normaal uit een
// test komt, niet los geschat). Hartslagzones hergebruiken
// berekenHartslagZones() uit cycling-zones.ts — dat model is al
// sport-onafhankelijk, geen dubbele implementatie.

interface RunningPreferences {
  laatste_race_afstand_m?: number
  laatste_race_tijd_sec?: number
  laatste_race_datum?: string
  max_hartslag?: number
  heeft_hartslagmeter?: boolean
  heeft_cadanssensor?: boolean
  heeft_hardloop_vermogensmeter?: boolean
  trainingsdagen?: string[]
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
      .eq('specialist_type', 'running')
      .maybeSingle()

    const prefs: RunningPreferences = data?.preferences || {}

    const vdot = prefs.laatste_race_afstand_m && prefs.laatste_race_tijd_sec
      ? berekenVDOT(prefs.laatste_race_afstand_m, prefs.laatste_race_tijd_sec)
      : null

    return NextResponse.json({
      profiel: prefs,
      vdot: vdot !== null ? Math.round(vdot * 10) / 10 : null,
      pacezones: vdot !== null ? berekenPaceZones(vdot) : null,
      hartslagzones: prefs.max_hartslag ? berekenHartslagZones(prefs.max_hartslag) : null,
    })
  } catch (err) {
    console.error('[specialists/running/profile GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await req.json()

    const nieuw: RunningPreferences = {}
    if (body.laatste_race_afstand_m !== undefined) {
      if (typeof body.laatste_race_afstand_m !== 'number' || body.laatste_race_afstand_m <= 0 || body.laatste_race_afstand_m > 250000) {
        return NextResponse.json({ error: 'Race-afstand moet een getal tussen 1 en 250.000 meter zijn' }, { status: 400 })
      }
      nieuw.laatste_race_afstand_m = body.laatste_race_afstand_m
    }
    if (body.laatste_race_tijd_sec !== undefined) {
      if (typeof body.laatste_race_tijd_sec !== 'number' || body.laatste_race_tijd_sec <= 0 || body.laatste_race_tijd_sec > 86400) {
        return NextResponse.json({ error: 'Race-tijd moet een getal tussen 1 seconde en 24 uur zijn' }, { status: 400 })
      }
      nieuw.laatste_race_tijd_sec = body.laatste_race_tijd_sec
    }
    if (body.laatste_race_datum !== undefined) {
      if (typeof body.laatste_race_datum !== 'string') {
        return NextResponse.json({ error: 'Race-datum moet een tekst zijn (ISO-datum)' }, { status: 400 })
      }
      nieuw.laatste_race_datum = body.laatste_race_datum
    }
    if (body.max_hartslag !== undefined) {
      if (typeof body.max_hartslag !== 'number' || body.max_hartslag <= 0 || body.max_hartslag > 250) {
        return NextResponse.json({ error: 'Max hartslag moet een getal tussen 1 en 250 zijn' }, { status: 400 })
      }
      nieuw.max_hartslag = body.max_hartslag
    }
    for (const veld of ['heeft_hartslagmeter', 'heeft_cadanssensor', 'heeft_hardloop_vermogensmeter'] as const) {
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

    const { data: bestaand } = await supabase
      .from('specialist_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .eq('specialist_type', 'running')
      .maybeSingle()

    const samengevoegd = { ...(bestaand?.preferences || {}), ...nieuw }

    const { error } = await supabase
      .from('specialist_profiles')
      .upsert({
        user_id: user.id,
        specialist_type: 'running',
        preferences: samengevoegd,
      }, { onConflict: 'user_id,specialist_type' })

    if (error) throw error

    const vdot = samengevoegd.laatste_race_afstand_m && samengevoegd.laatste_race_tijd_sec
      ? berekenVDOT(samengevoegd.laatste_race_afstand_m, samengevoegd.laatste_race_tijd_sec)
      : null

    return NextResponse.json({
      profiel: samengevoegd,
      vdot: vdot !== null ? Math.round(vdot * 10) / 10 : null,
      pacezones: vdot !== null ? berekenPaceZones(vdot) : null,
      hartslagzones: samengevoegd.max_hartslag ? berekenHartslagZones(samengevoegd.max_hartslag) : null,
    })
  } catch (err) {
    console.error('[specialists/running/profile PUT]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
