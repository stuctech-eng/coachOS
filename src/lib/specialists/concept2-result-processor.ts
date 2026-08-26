import type { SupabaseClient } from '@supabase/supabase-js'
import { haalAthleteState, slaAthleteStateOp } from '@/core/athlete-platform/storage'
import { pasImpactToe, MINIMUM_SESSIE_DUUR_MINUTEN } from '@/core/athlete-platform/impact-engine'
import { vertaalRowingSessieNaarImpact } from '@/lib/specialists/rowing-impact-adapter'
import { pasGeleerdeAanpassingenToe, type GeleerdPatroon } from '@/core/athlete-platform/learned-adjustments'
import { matchActiviteitAanPlan } from '@/lib/specialists/training-plan-engine/workout-matcher'
import { rowingMatcher } from '@/lib/specialists/training-plan-engine/matchers/rowing-matcher'
import { nieuweBronWint } from '@/lib/activity-import/source-priority-policy'
import { evalueerCoachCallBehoefte } from '@/lib/coach/coach-decision-engine'
import { schrijfCoachCallItem } from '@/lib/coach/coach-call-writer'

// ── Gedeelde Concept2-resultaatverwerking ────────────────────────────────
// Bron: v2.4.286 (Concept2-webhook). Geëxtraheerd uit
// concept2/sync/route.ts's for-lus — die logica bestond al, correct en
// grondig getest deze week (idempotency/metrics/matching/dedup). De
// webhook-route (nieuw, verwerkt telkens ÉÉN resultaat i.p.v. een hele
// lijst) heeft exact dezelfde stappen nodig — dit bestand voorkomt een
// tweede, losse kopie (architectuurregel "dubbele utilities vermijden",
// zelfde reden als matcher-registry.ts/activiteit-sport-mapping.ts eerder
// deze week).
//
// Gedrag is bewust 1-op-1 ongewijzigd overgenomen — dit is een
// extractie, geen herschrijving. concept2/sync/route.ts roept deze
// functie nu aan i.p.v. de logica zelf te bevatten.

export interface Concept2Result {
  id: number
  date: string // "2013-06-21 00:00:00"
  distance: number
  type: string
  time: number // tienden van een seconde
  workout_type: string
  stroke_rate?: number
  heart_rate?: { average?: number; min?: number; max?: number; ending?: number; recovery?: number }
  calories_total?: number
  drag_factor?: number
}

export type Concept2VerwerkUitkomst =
  | { status: 'geimporteerd'; activiteitId: string }
  | { status: 'overgeslagen' }
  | { status: 'fout'; foutmelding: string }

/** Verplaatst hierheen vanuit concept2/sync/route.ts (v2.4.373) —
 * intervaldata-detailcall (zie verderop) heeft dit ook nodig, en de
 * webhook-route had helemaal geen tokenlogica. Eén plek i.p.v. straks
 * een derde kopie (architectuurregel "dubbele utilities vermijden").
 * Gedrag exact ongewijzigd overgenomen — puur een verplaatsing. */
export async function haalGeldigToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: tokenRij } = await supabase
    .from('concept2_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!tokenRij) return null

  if (new Date(tokenRij.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return tokenRij.access_token
  }

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
    console.error('[concept2-result-processor] Token-vernieuwing mislukt:', refreshRes.status, await refreshRes.text())
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

// ── Intervaldata — v2.4.373 ──────────────────────────────────────────────
// Bron: Fase 2-live-validatie tegen Concept2's EIGEN API (25 augustus
// 2026, niet Intervals.icu) — bevestigd via /debug: GET /results/{id}
// (zonder ?include=strokes) geeft al workout.intervals terug, met time/
// distance/stroke_rate/heart_rate per interval. Apart, licht endpoint
// t.o.v. de lijst-call — vandaar hier een eigen, kleine helper i.p.v.
// dit in de hoofdfunctie te vermengen.
//
// BEWUST: geen ?include=strokes (niet nodig, bevestigd veel grotere
// respons zonder toegevoegde waarde voor dit doel). BEWUST: faalt deze
// aanroep, dan geeft de functie null terug — de aanroeper beslist zelf
// dat de basisimport hierdoor nooit mag mislukken.
async function haalConcept2Intervallen(accessToken: string, resultId: number): Promise<unknown[] | null> {
  try {
    const res = await fetch(`https://log.concept2.com/api/users/me/results/${resultId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.c2logbook.v1+json' },
    })
    if (!res.ok) {
      console.error('[concept2-result-processor] Intervaldetail ophalen mislukt:', resultId, res.status)
      return null
    }
    const json = await res.json() as { data?: { workout?: { intervals?: unknown[] } } }
    const intervallen = json.data?.workout?.intervals
    return Array.isArray(intervallen) && intervallen.length > 0 ? intervallen : null
  } catch (err) {
    console.error('[concept2-result-processor] Intervaldetail-aanroep mislukt:', resultId, err)
    return null
  }
}

/** Zoekt of maakt de "Roeien"-activiteit voor deze gebruiker — één keer
 * per aanroeper aan te roepen (niet per resultaat), zelfde als voorheen
 * in sync/route.ts. */
export async function haalOfMaakRoeiActiviteit(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: bestaand } = await supabase
    .from('activities').select('id').eq('user_id', userId).eq('name', 'Roeien').maybeSingle()
  if (bestaand) return bestaand.id

  const { data: template } = await supabase
    .from('activity_templates').select('id').eq('name', 'Roeien').maybeSingle()
  const { data: nieuw } = await supabase
    .from('activities').insert({ user_id: userId, template_id: template?.id || null, name: 'Roeien' })
    .select('id').single()
  return nieuw?.id || null
}

export async function verwerkConcept2Resultaat(
  supabase: SupabaseClient,
  userId: string,
  activiteitId: string | null,
  resultaat: Concept2Result,
  geleerdePatronen: GeleerdPatroon[],
): Promise<Concept2VerwerkUitkomst> {
  // Idempotency-check — ongewijzigd
  const { data: bestaat } = await supabase
    .from('activity_sessions').select('id')
    .eq('user_id', userId).eq('source', 'concept2')
    .ilike('notes', `%concept2:${resultaat.id}%`)
    .maybeSingle()
  if (bestaat) return { status: 'overgeslagen' }

  const metrics: Record<string, unknown> = { distance: resultaat.distance }
  if (resultaat.stroke_rate) metrics.avg_stroke_rate = resultaat.stroke_rate
  if (resultaat.heart_rate?.average) metrics.avg_hr = resultaat.heart_rate.average
  if (resultaat.heart_rate?.max) metrics.max_hr = resultaat.heart_rate.max
  if (resultaat.calories_total) metrics.calories = resultaat.calories_total
  if (resultaat.drag_factor) metrics.drag_factor = resultaat.drag_factor
  // v2.4.310 (Rowing Performance Center — Records/Afstand-trends):
  // Concept2 geeft de duur in tienden van een seconde (resultaat.time),
  // maar activity_sessions.duration wordt bewust afgerond op hele
  // minuten (regel hieronder, ongewijzigd — de CTL/ATL/TSB-berekening
  // heeft daar niets aan een preciezere waarde). Voor een PR/record is
  // een afronding op de minuut te grof (7:32 zou 8:00 worden) — daarom
  // hier apart, puur additief, de precieze waarde bewaard.
  metrics.precieze_duur_sec = Math.round(resultaat.time / 10)

  // v2.4.373: intervaldata — ALLEEN hier, want dit punt wordt uitsluitend
  // bereikt voor een resultaat dat de idempotency-check hierboven al is
  // gepasseerd (dus daadwerkelijk nieuw). Vóór de insert, zodat
  // metrics.intervallen in dezelfde, enkele schrijfactie meegaat i.p.v.
  // een aparte update() erna. Faalt de tokenophaal of de detailcall, dan
  // blijft metrics.intervallen gewoon afwezig — de import hieronder gaat
  // altijd door, ongeacht dit resultaat.
  try {
    const detailToken = await haalGeldigToken(supabase, userId)
    if (detailToken) {
      const intervallen = await haalConcept2Intervallen(detailToken, resultaat.id)
      if (intervallen) metrics.intervallen = intervallen
    }
  } catch (intervalErr) {
    console.error('[concept2-result-processor] Intervaldata-stap mislukt, import gaat door zonder:', resultaat.id, intervalErr)
  }

  const duurMinuten = Math.round(resultaat.time / 600)
  const dagStr = resultaat.date.split(' ')[0]

  const { data: nieuweRij, error } = await supabase.from('activity_sessions').insert({
    user_id: userId,
    activity_id: activiteitId,
    date: dagStr,
    duration: duurMinuten,
    metrics,
    source: 'concept2',
    notes: `concept2:${resultaat.id}`,
  }).select('id').single()

  if (error) {
    console.error('[concept2-result-processor] Insert mislukt voor resultaat', resultaat.id, error)
    return { status: 'fout', foutmelding: error.message }
  }

  if (duurMinuten >= MINIMUM_SESSIE_DUUR_MINUTEN) {
    try {
      const huidigeState = await haalAthleteState(supabase, userId)
      const bijdragen = vertaalRowingSessieNaarImpact(duurMinuten)
      const nieuweState = pasImpactToe(huidigeState, bijdragen)
      const stateNaGeleerdeAanpassingen = pasGeleerdeAanpassingenToe(nieuweState, geleerdePatronen)
      await slaAthleteStateOp(supabase, userId, stateNaGeleerdeAanpassingen)
    } catch (athleteStateErr) {
      console.error('[concept2-result-processor] Universal Athlete State bijwerken mislukt:', athleteStateErr)
    }
  }

  if (nieuweRij) {
    try {
      await matchActiviteitAanPlan(
        { id: nieuweRij.id, userId, sport: 'rowing', date: dagStr, durationMinutes: duurMinuten, metrics },
        rowingMatcher,
      )
    } catch (matchErr) {
      console.error('[concept2-result-processor] Workout matching mislukt:', matchErr)
    }
  }

  const { data: bestaandeDieDag } = await supabase
    .from('activity_sessions')
    .select('id, source')
    .eq('user_id', userId).eq('date', dagStr).eq('activity_id', activiteitId)
  const teVerwijderen = (bestaandeDieDag || [])
    .filter(rij => nieuweBronWint('concept2', rij.source))
    .map(rij => rij.id)
  if (teVerwijderen.length > 0) {
    await supabase.from('activity_sessions').delete().in('id', teVerwijderen)
  }

  // v2.4.288 (Coach Decision Engine, Fase 1 — eerste toepassing, zie
  // module-comment in coach-decision-engine.ts): Concept2 had tot nu
  // toe GEEN enkele Coach Call-trigger (nevenbevinding uit
  // guardian-mode-coach-call-trigger-v1.md, nu opgelost — niet door
  // Concept2 dezelfde oude, directe aanmaaklogica te geven als Garmin/
  // Strava, maar door de nieuwe, centrale Decision Engine hier als
  // eerste toe te passen). Bewust in try/catch — mag de import zelf
  // nooit laten falen.
  try {
    const behoefte = await evalueerCoachCallBehoefte(supabase, userId, 'rowing', dagStr, duurMinuten)
    if (behoefte.nodig) {
      await schrijfCoachCallItem(supabase, userId, dagStr, {
        activiteitId: nieuweRij.id,
        sportNaam: 'Roeien',
        afstandM: resultaat.distance || null,
        duurMin: duurMinuten,
        redenType: behoefte.type,
        reden: behoefte.reden,
      })
    }
  } catch (decisionErr) {
    console.error('[concept2-result-processor] Coach Decision Engine mislukt:', decisionErr)
  }

  return { status: 'geimporteerd', activiteitId: nieuweRij.id }
}

/** Voor result-deleted webhook-events — verwijdert de bijbehorende
 * activity_sessions-rij, indien aanwezig. Geen equivalent nodig in de
 * sync-route (die kent alleen "ophalen", geen deletes vanuit Concept2). */
export async function verwijderConcept2Resultaat(supabase: SupabaseClient, userId: string, concept2ResultId: number): Promise<boolean> {
  const { data } = await supabase
    .from('activity_sessions').select('id')
    .eq('user_id', userId).eq('source', 'concept2')
    .ilike('notes', `%concept2:${concept2ResultId}%`)
    .maybeSingle()
  if (!data) return false
  await supabase.from('activity_sessions').delete().eq('id', data.id)
  return true
}
