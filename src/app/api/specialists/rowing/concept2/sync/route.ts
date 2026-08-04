export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { haalAthleteState, slaAthleteStateOp } from '@/core/athlete-platform/storage'
import { pasImpactToe, MINIMUM_SESSIE_DUUR_MINUTEN } from '@/core/athlete-platform/impact-engine'
import { vertaalRowingSessieNaarImpact } from '@/lib/specialists/rowing-impact-adapter'
import { evalueerEnBewaarLeerpatronenIndienNodig } from '@/lib/specialists/learning-rules-koppeling'
import { pasGeleerdeAanpassingenToe, type GeleerdPatroon } from '@/core/athlete-platform/learned-adjustments'
import { matchActiviteitAanPlan } from '@/lib/specialists/training-plan-engine/workout-matcher'
import { rowingMatcher } from '@/lib/specialists/training-plan-engine/matchers/rowing-matcher'

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

interface Concept2Result {
  id: number
  date: string // "2013-06-21 00:00:00"
  distance: number // meters
  type: string // 'rower' | 'skierg' | 'bike' | ...
  time: number // TIENDEN VAN EEN SECONDE — 600 = 1 minuut
  workout_type: string
  stroke_rate?: number
  heart_rate?: { average?: number; min?: number; max?: number; ending?: number; recovery?: number }
  calories_total?: number
  drag_factor?: number
}

// v2.4.219 (Rowing Platform Fase 1, stap 2 — data-sync): haalt
// resultaten op bij Concept2 (GET /api/users/me/results?type=rower) en
// slaat ze op in activity_sessions — exact hetzelfde patroon als
// strava-activity-processor.ts (idempotency via notes, activities-
// koppeling, metrics als JSON), geen nieuwe insert-logica verzonnen.
//
// Belangrijk eenheidsverschil met Strava: Concept2's "time"-veld is
// in TIENDEN VAN EEN SECONDE (600 = 1 minuut), niet seconden — vandaar
// /600 i.p.v. Strava's /60 (die begint al in seconden).
//
// v2.4.267 (Workout Matching Service, Fase 1 — Rowing referentie-
// implementatie, docs/workout-completion-platform-adr-v1.md): na een
// succesvolle import wordt de nieuwe activiteit nu ook aangeboden aan
// de Workout Matching Service, die bepaalt of hij bij een geplande
// training_plan_session hoort. Zelfde try/catch-discipline als de
// Universal Athlete State-koppeling hieronder — een fout hier mag de
// sync zelf nooit laten falen.

async function haalGeldigToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: tokenRij } = await supabase
    .from('concept2_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!tokenRij) return null

  // Nog geldig? (met 5 min marge)
  if (new Date(tokenRij.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return tokenRij.access_token
  }

  // Verlopen — vernieuwen via refresh_token grant
  const clientId = process.env.CONCEPT2_CLIENT_ID
  const clientSecret = process.env.CONCEPT2_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const refreshRes = await fetch('https://log.concept2.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokenRij.refresh_token,
      scope: 'results:read',
    }),
  })
  if (!refreshRes.ok) {
    console.error('[concept2/sync] Token-vernieuwing mislukt:', refreshRes.status, await refreshRes.text())
    return null
  }
  const nieuweTokens = await refreshRes.json() as { access_token: string; refresh_token: string; expires_in: number }
  const nieuweExpiresAt = new Date(Date.now() + nieuweTokens.expires_in * 1000).toISOString()

  await supabase.from('concept2_tokens').update({
    access_token: nieuweTokens.access_token,
    refresh_token: nieuweTokens.refresh_token,
    expires_at: nieuweExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return nieuweTokens.access_token
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const accessToken = await haalGeldigToken(user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Geen geldige Concept2-koppeling — verbind opnieuw' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Laatste 2 jaar ophalen — ruim genoeg voor een eerste sync,
    // voorkomt onnodig grote responses bij lange logbook-historie
    const van = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let alleResultaten: Concept2Result[] = []
    let volgendeUrl: string | null =
      `https://log.concept2.com/api/users/me/results?type=rower&from=${van}&number=100`

    // v2.4.220-FIX: gemeld — sync gaf "0 nieuwe, 0 al bekend" terug
    // terwijl er wél degelijk 9+ sessies in het Concept2 Logbook
    // stonden (bevestigd met screenshot). De vorige versie verborg de
    // precieze oorzaak: als totaalGevonden al 0 was (API gaf niets
    // terug), zag dat er in de UI hetzelfde uit als "alles al bekend".
    // Nu: de ruwe API-respons van de EERSTE pagina wordt gelogd zodra
    // er 0 resultaten binnenkomen, en totaalGevonden gaat mee in de
    // respons naar de UI.
    let ruweEersteRespons: unknown = null
    let paginas = 0
    while (volgendeUrl && paginas < 20) {
      const res: Response = await fetch(volgendeUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.c2logbook.v1+json',
        },
      })
      if (!res.ok) {
        const tekst = await res.text()
        console.error('[concept2/sync] Ophalen resultaten mislukt:', res.status, tekst)
        return NextResponse.json({ error: `Ophalen bij Concept2 mislukt (${res.status}): ${tekst.slice(0, 200)}` }, { status: 502 })
      }
      const json = await res.json() as { data: Concept2Result[]; meta?: { pagination?: { links?: { next?: string } } } }
      if (paginas === 0) ruweEersteRespons = json
      alleResultaten = alleResultaten.concat(json.data || [])
      volgendeUrl = json.meta?.pagination?.links?.next || null
      paginas++
    }

    if (alleResultaten.length === 0) {
      console.error('[concept2/sync] 0 resultaten van Concept2 — ruwe respons:', JSON.stringify(ruweEersteRespons).slice(0, 1000))
    }

    // Zoek of maak de "Roeien"-activiteit voor deze gebruiker aan
    let { data: userActivity } = await supabase
      .from('activities').select('id').eq('user_id', user.id).eq('name', 'Roeien').maybeSingle()

    if (!userActivity) {
      const { data: template } = await supabase
        .from('activity_templates').select('id').eq('name', 'Roeien').maybeSingle()
      const { data: newActivity } = await supabase
        .from('activities').insert({ user_id: user.id, template_id: template?.id || null, name: 'Roeien' })
        .select().single()
      userActivity = newActivity
    }

    let geimporteerd = 0
    let overgeslagen = 0
    let eersteInsertFout: string | null = null

    // v2.4.256 (Learning Rules Engine — daadwerkelijk toegepast): één
    // keer ophalen vóór de lus, niet per sessie opnieuw (56 sessies zou
    // anders 56 onnodige queries geven voor exact dezelfde data).
    const { data: geleerdePatronenData } = await supabase
      .from('learned_patterns').select('effect_pad, aanpassing_percentage').eq('user_id', user.id).eq('sport', 'rowing')
    const geleerdePatronen: GeleerdPatroon[] = geleerdePatronenData || []

    // v2.4.258-FIX: gemeld — "dus indoor en buiten, weet hij ook?".
    // Antwoord was nee: v2.4.257 paste weer-gebaseerde hitte/koude-
    // adaptatie toe op ELKE Rowing-sessie, zonder te checken of die wel
    // buiten was. Concept2 is per definitie een indoor roeimachine —
    // er is hier geen enkel scenario waarin het weer buiten relevant
    // is. De weer-adapter-aanroep is daarom volledig verwijderd uit
    // deze route, niet alleen voorwaardelijk gemaakt — Rowing via
    // Concept2 hoort NOOIT weer-impact te krijgen.

    for (const resultaat of alleResultaten) {
      // Idempotency-check — zelfde patroon als Strava
      const { data: bestaat } = await supabase
        .from('activity_sessions').select('id')
        .eq('user_id', user.id).eq('source', 'concept2')
        .ilike('notes', `%concept2:${resultaat.id}%`)
        .maybeSingle()

      if (bestaat) { overgeslagen++; continue }

      const metrics: Record<string, unknown> = { distance: resultaat.distance }
      if (resultaat.stroke_rate) metrics.avg_stroke_rate = resultaat.stroke_rate
      if (resultaat.heart_rate?.average) metrics.avg_hr = resultaat.heart_rate.average
      if (resultaat.heart_rate?.max) metrics.max_hr = resultaat.heart_rate.max
      if (resultaat.calories_total) metrics.calories = resultaat.calories_total
      if (resultaat.drag_factor) metrics.drag_factor = resultaat.drag_factor

      // v2.4.238: duur naar een eigen variabele — nu ook hergebruikt
      // voor de Universal Athlete Platform-koppeling hieronder
      const duurMinuten = Math.round(resultaat.time / 600)
      // v2.4.267: ook naar een eigen variabele — hergebruikt voor zowel
      // de dedup-delete hieronder als de nieuwe matching-aanroep, i.p.v.
      // 'm twee keer apart uit te rekenen
      const dagStr = resultaat.date.split(' ')[0]

      const { data: nieuweRij, error } = await supabase.from('activity_sessions').insert({
        user_id: user.id,
        activity_id: userActivity?.id || null,
        date: dagStr,
        // v2.4.219: Concept2's "time" is in tienden van een seconde,
        // NIET seconden (anders dan Strava's moving_time) — /600 geeft
        // direct minuten (/10 voor seconden, /60 voor minuten)
        duration: duurMinuten,
        metrics,
        source: 'concept2',
        notes: `concept2:${resultaat.id}`,
      }).select('id').single()

      if (error) {
        console.error('[concept2/sync] Insert mislukt voor resultaat', resultaat.id, error)
        if (!eersteInsertFout) eersteInsertFout = error.message
        continue
      }
      geimporteerd++

      // v2.4.238 (Universal Athlete Platform, eerste echte koppeling):
      // vertaalt deze sessie naar universele impact-bijdragen en werkt
      // de opgeslagen Universal Athlete State bij. Bewust in een
      // try/catch — een fout hier mag de sync zelf nooit laten falen,
      // de kernfunctionaliteit (data importeren) blijft altijd werken
      // ook als deze nieuwe, experimentele laag een probleem heeft.
      // v2.4.246-FIX: sessies onder MINIMUM_SESSIE_DUUR_MINUTEN
      // (vermoedelijk test/kalibratie, geen echte training) worden
      // overgeslagen — trokken eerder het gemiddelde onterecht omlaag.
      if (duurMinuten >= MINIMUM_SESSIE_DUUR_MINUTEN) {
        try {
          const huidigeState = await haalAthleteState(supabase, user.id)
          const bijdragen = vertaalRowingSessieNaarImpact(duurMinuten)
          const nieuweState = pasImpactToe(huidigeState, bijdragen)
          const stateNaGeleerdeAanpassingen = pasGeleerdeAanpassingenToe(nieuweState, geleerdePatronen)
          await slaAthleteStateOp(supabase, user.id, stateNaGeleerdeAanpassingen)
        } catch (athleteStateErr) {
          console.error('[concept2/sync] Universal Athlete State bijwerken mislukt (sync zelf blijft werken):', athleteStateErr)
        }
      }

      // v2.4.267 (Workout Matching Service, Fase 1 — zie module-comment
      // bovenaan dit bestand): koppelt deze net-geïmporteerde activiteit
      // aan een geplande sessie, indien aanwezig en aannemelijk genoeg.
      // Bewust in try/catch, zelfde reden als de Universal Athlete
      // State-koppeling hierboven.
      if (nieuweRij) {
        try {
          await matchActiviteitAanPlan(
            { id: nieuweRij.id, userId: user.id, sport: 'rowing', date: dagStr, durationMinutes: duurMinuten, metrics },
            rowingMatcher,
          )
        } catch (matchErr) {
          console.error('[concept2/sync] Workout matching mislukt (sync zelf blijft werken):', matchErr)
        }
      }

      // v2.4.222 (structurele dedup-fix): Concept2 is de meest
      // betrouwbare bron voor roeien (het apparaat zelf). Als er voor
      // dezelfde dag al een lagere-prioriteit-record bestaat (Strava/
      // Garmin/handmatig — bijv. omdat die eerder is binnengekomen dan
      // deze Concept2-sync), wordt die nu verwijderd. Voorkomt dubbele
      // sessies structureel, niet alleen in de weergave.
      await supabase.from('activity_sessions').delete()
        .eq('user_id', user.id).eq('date', dagStr).eq('activity_id', userActivity?.id || null)
        .in('source', ['strava', 'garmin', 'apple_health', 'manual'])
    }

    // v2.4.253 (Learning Rules Engine — daadwerkelijke koppeling): één
    // keer ná de hele sync-lus, niet per sessie (zou dezelfde context
    // onnodig herhaald evalueren). Alleen als er daadwerkelijk iets
    // nieuws is geïmporteerd — anders is er niets veranderd om opnieuw
    // te evalueren.
    if (geimporteerd > 0) {
      await evalueerEnBewaarLeerpatronenIndienNodig(user.id, 'rowing')
    }

    return NextResponse.json({
      geimporteerd, overgeslagen, totaalGevonden: alleResultaten.length,
      // v2.4.220: diagnostiek, zodat "0/0" niet langer ambigu is
      eersteInsertFout,
    })
  } catch (err) {
    console.error('[concept2/sync]', err)
    return NextResponse.json({ error: 'Sync mislukt' }, { status: 500 })
  }
}
