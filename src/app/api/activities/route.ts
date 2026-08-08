export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { ACTIVITEIT_NAAM_NAAR_SPORT_SLEUTEL } from '@/lib/specialists/training-plan-engine/activiteit-sport-mapping'
import { berekenGeschatteTSS } from '@/lib/specialists/cycling-grafieken'
import { berekenGeschatteRunningTSS, berekenDrempelsnelheidKmh } from '@/lib/specialists/running-grafieken'
import { berekenVDOT } from '@/lib/specialists/running-zones'
import { berekenGeschatteRowingTSS, berekenRowingDrempelsnelheid } from '@/lib/specialists/rowing-grafieken'

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

// v2.4.40: POST (Garmin GPX/TCX import) volledig verwijderd. Was een
// oudere, kapotte importweg — de regex-based TCX-parser las met
// `content.match(/<TotalTimeSeconds>.../)` alleen de EERSTE match in het
// hele bestand, dus bij een activiteit met meerdere laps (bijna elk
// TCX-bestand) werd alleen lap 1 gebruikt in plaats van het totaal. Ook
// ontbrak een Coach Call-trigger, dus activiteiten via deze weg telden
// nooit mee in de herstelberekening. Vervangen door de geteste flow op
// /settings/garmin-activity-import (client-side TCX-parsing incl.
// meerdere laps, zie v2.4.25/35, plus altijd een Coach Call, v2.4.23).
// GET blijft ongewijzigd — wordt nog gebruikt om de activiteitenlijst
// op /activities te laden.
//
// v2.4.305 (Activiteiten-scherm, Stap 3): uitgebreid met server-side
// TSS per activiteit + een gecombineerd weekdoel. GEEN nieuwe
// TSS-formule — de drie bestaande, al-geteste, geëxporteerde pure
// functies (cycling/running/rowing-grafieken.ts) worden hier
// rechtstreeks aangeroepen, precies zoals vastgesteld in de
// verificatiefase. Wandelen krijgt bewust GEEN tss-waarde — geen
// bestaande formule, geen nieuwe verzinnen (architectuurbesluit,
// vastgelegd 8 augustus 2026).
//
// Eerlijke beperking, expliciet: Cycling-TSS vergt metrics.avg_watts
// (niet altijd aanwezig, afhankelijk van bron), Running/Rowing-TSS
// vergen metrics.distance (idem). Zonder de benodigde metric of zonder
// een ingevuld specialist-profiel (ftp/laatste_race_.../laatste_2k_tijd_sec)
// blijft tss simpelweg null — nooit een geschat/gegokt getal.

interface Preferences {
  ftp?: number
  laatste_race_afstand_m?: number
  laatste_race_tijd_sec?: number
  laatste_2k_tijd_sec?: number
  beschikbare_uren_per_week?: number
}

const INTENSITEIT_DREMPELS = { laag: 40, hoog: 70 } // TSS < 40 = laag, 40-70 = gemiddeld, > 70 = hoog

function bepaalIntensiteit(tss: number): 'laag' | 'gemiddeld' | 'hoog' {
  if (tss < INTENSITEIT_DREMPELS.laag) return 'laag'
  if (tss > INTENSITEIT_DREMPELS.hoog) return 'hoog'
  return 'gemiddeld'
}

// GET — haal alle activiteit sessies op
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    const [sessionsRes, profielenRes] = await Promise.all([
      supabase
        .from('activity_sessions')
        .select(`*, activities (id, name)`)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100),
      supabase
        .from('specialist_profiles')
        .select('specialist_type, preferences')
        .eq('user_id', user.id)
        .in('specialist_type', ['cycling', 'running', 'rowing']),
    ])

    if (sessionsRes.error) throw sessionsRes.error

    // v2.4.305: concept2_user_id nodig voor de Concept2-deep-link —
    // zelfde bron als /debug/concept2-webhook al gebruikt, hier
    // hergebruikt i.p.v. de client dit apart te laten opvragen.
    const { data: concept2TokenRij } = await supabase
      .from('concept2_tokens').select('concept2_user_id').eq('user_id', user.id).maybeSingle()

    const profielen: Record<string, Preferences> = {}
    for (const p of profielenRes.data || []) {
      profielen[p.specialist_type] = (p.preferences || {}) as Preferences
    }

    // Weekdoel — som van beschikbare_uren_per_week over sporten met een
    // ingevuld profiel. Geen nieuw doelensysteem, puur optellen van wat
    // er al bestaat (architectuurbesluit).
    let weekdoelMinuten = 0
    for (const sport of ['cycling', 'running', 'rowing']) {
      const uren = profielen[sport]?.beschikbare_uren_per_week
      if (uren) weekdoelMinuten += uren * 60
    }

    const sessies = (sessionsRes.data || []).map(sessie => {
      const sportNaam = (sessie.activities as { name: string } | null)?.name || null
      const sportSleutel = sportNaam ? ACTIVITEIT_NAAM_NAAR_SPORT_SLEUTEL[sportNaam] : null
      const metrics = (sessie.metrics || {}) as { distance?: number; avg_watts?: number }

      let tss: number | null = null

      if (sportSleutel === 'cycling') {
        const ftp = profielen.cycling?.ftp
        if (ftp && metrics.avg_watts && sessie.duration > 0) {
          tss = Math.round(berekenGeschatteTSS(sessie.duration, metrics.avg_watts, ftp))
        }
      } else if (sportSleutel === 'running') {
        const prefs = profielen.running
        if (prefs?.laatste_race_afstand_m && prefs?.laatste_race_tijd_sec && metrics.distance && sessie.duration > 0) {
          const vdot = berekenVDOT(prefs.laatste_race_afstand_m, prefs.laatste_race_tijd_sec)
          const drempelKmh = berekenDrempelsnelheidKmh(vdot)
          const snelheidKmh = (metrics.distance / 1000) / (sessie.duration / 60)
          tss = Math.round(berekenGeschatteRunningTSS(sessie.duration, snelheidKmh, drempelKmh))
        }
      } else if (sportSleutel === 'rowing') {
        const tweeKmTijd = profielen.rowing?.laatste_2k_tijd_sec
        if (tweeKmTijd && metrics.distance && sessie.duration > 0) {
          const drempelMPerMin = berekenRowingDrempelsnelheid(tweeKmTijd)
          const snelheidMPerMin = metrics.distance / sessie.duration
          tss = Math.round(berekenGeschatteRowingTSS(sessie.duration, snelheidMPerMin, drempelMPerMin))
        }
      }
      // Wandelen (en elke andere/onbekende sport): tss blijft null,
      // bewust geen formule — geen gegokte belastingswaarde.

      // v2.4.305: bronlink server-side gebouwd — Concept2 naar de
      // specifieke workout (concept2_user_id + result-ID uit notes,
      // formaat bevestigd via twee onafhankelijke forumvoorbeelden;
      // NOG NIET handmatig geverifieerd i.v.m. Concept2's eigen
      // API-instabiliteit, zie docs/changelog.md), Garmin/Strava naar
      // hun algemene dashboard (geen specifieke-activiteit-ID meer
      // proberen te construeren — Strava's betaalmodel maakt dat
      // onbetrouwbaar, Garmin's TCX-import geeft sowieso geen bruikbaar
      // web-ID). Trainer AI/onbekend: geen externe link, valt terug op
      // de bestaande interne /activities/[id]-detailpagina.
      let bronLink: string | null = null
      if (sessie.source === 'concept2' && concept2TokenRij?.concept2_user_id) {
        const match = (sessie.notes as string | null)?.match(/concept2:(\d+)/)
        if (match) bronLink = `https://log.concept2.com/profile/${concept2TokenRij.concept2_user_id}/log/${match[1]}`
      } else if (sessie.source === 'garmin') {
        bronLink = 'https://connect.garmin.com/modern/activities'
      } else if (sessie.source === 'strava') {
        bronLink = 'https://www.strava.com/dashboard'
      }

      return {
        ...sessie,
        tss,
        intensiteit: tss !== null ? bepaalIntensiteit(tss) : null,
        bronLink,
      }
    })

    return NextResponse.json({ sessions: sessies, weekdoelMinuten })
  } catch (error) {
    console.error('Activiteiten ophalen fout:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
