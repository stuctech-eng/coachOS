// ─── Gedeelde Strava activiteitsverwerking ────────────────────────────────────
// Gebruikt door zowel handmatige sync (/api/strava/sync) als webhook
// (/api/strava/webhook). Idempotent — dubbele activiteiten worden overgeslagen.

import { createAdminClient } from '@/lib/supabase'
import { haalAthleteState, slaAthleteStateOp } from '@/core/athlete-platform/storage'
import { pasImpactToe, type ImpactBijdrage, MINIMUM_SESSIE_DUUR_MINUTEN } from '@/core/athlete-platform/impact-engine'
import { vertaalRunningSessieNaarImpact } from './specialists/running-impact-adapter'
import { evalueerEnBewaarLeerpatronenIndienNodig } from './specialists/learning-rules-koppeling'
import { pasGeleerdeAanpassingenToe, type GeleerdPatroon } from '@/core/athlete-platform/learned-adjustments'
import { haalHuidigWeer, vertaalWeerNaarImpact } from './specialists/weer-impact-adapter'

// v2.4.276: ACTIVITEIT_NAAR_SPORT_SLEUTEL verhuisd naar een gedeeld
// bestand (activiteit-sport-mapping.ts) — Garmin TCX heeft dezelfde
// mapping nu ook nodig, en een tweede lokale kopie zou uit elkaar
// kunnen groeien (Source Isolation-principe, ADR §2b: één vertaling,
// niet per importroute opnieuw verzonnen).
import { ACTIVITEIT_NAAM_NAAR_SPORT_SLEUTEL as ACTIVITEIT_NAAR_SPORT_SLEUTEL } from './specialists/training-plan-engine/activiteit-sport-mapping'
import { vertaalCyclingSessieNaarImpact } from './specialists/cycling-impact-adapter'
import { matchActiviteitAanPlan } from './specialists/training-plan-engine/workout-matcher'
import { SPORT_MATCHERS } from './specialists/training-plan-engine/matcher-registry'
import { nieuweBronWint } from './activity-import/source-priority-policy'

// v2.4.244: Cycling toegevoegd — derde sport in de dispatch-tabel,
// zelfde generieke patroon, geen wijziging aan de processor zelf nodig
const IMPACT_ADAPTERS: Record<string, (duurMinuten: number) => ImpactBijdrage[]> = {
  Hardlopen: vertaalRunningSessieNaarImpact,
  Fietsen: vertaalCyclingSessieNaarImpact,
}

const SPORT_TYPE_MAP: Record<string, string> = {
  Run: 'Hardlopen',
  Ride: 'Fietsen',
  Walk: 'Wandelen',
  Swim: 'Zwemmen',
  Hike: 'Wandelen',
  WeightTraining: 'Krachttraining',
  Yoga: 'Yoga',
  Rowing: 'Roeien',
  Padel: 'Padel',
  Tennis: 'Tennis',
  Crossfit: 'CrossFit',
  Kettlebell: 'Kettlebell',
  VirtualRide: 'Fietsen',
  EBikeRide: 'Fietsen',
  NordicSki: 'Nordic Ski',
}

export interface StravaActivity {
  id: number
  sport_type: string
  start_date: string
  moving_time: number
  distance?: number
  average_heartrate?: number
  max_heartrate?: number
  total_elevation_gain?: number
  average_speed?: number
  kilojoules?: number
  average_watts?: number
  weighted_average_watts?: number
  average_cadence?: number
  // v2.4.258-FIX: Strava's API geeft dit veld al mee, stond alleen nog
  // niet getypeerd — nodig om indoor-sessies (trainer/Zwift) uit te
  // sluiten van weer-gebaseerde impact (gemeld: "dus indoor en buiten,
  // weet hij ook?" — antwoord was nee, nu wel).
  trainer?: boolean
}

export interface ProcessResult {
  imported: boolean
  skipped: boolean
  activity_session_id?: string
  reason?: string
}

/**
 * Verwerkt één Strava-activiteit voor een gebruiker.
 * Idempotent: als de activiteit al bestaat (strava:ID in notes) wordt
 * hij overgeslagen. Geen AI-calls — alleen data opslaan.
 */
export async function processStravaActivity(
  userId: string,
  activity: StravaActivity
): Promise<ProcessResult> {
  const supabase = createAdminClient()
  const activityName = SPORT_TYPE_MAP[activity.sport_type] || activity.sport_type || 'Anders'
  const date = activity.start_date.split('T')[0]

  // Idempotency check — bestaande activiteit via strava:ID in notes
  const { data: existing } = await supabase
    .from('activity_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'strava')
    .ilike('notes', '%strava:' + activity.id + '%')
    .single()

  if (existing) {
    return { imported: false, skipped: true, reason: 'already_exists' }
  }

  // Zoek of gebruiker deze activiteitssoort al heeft — vóór de dedup-
  // check verplaatst (v2.4.283), want die moet nu per SPORT filteren,
  // niet per dag over alle sporten heen (zie module-comment hieronder).
  let { data: userActivity } = await supabase
    .from('activities')
    .select('id')
    .eq('user_id', userId)
    .eq('name', activityName)
    .single()

  if (!userActivity) {
    const { data: template } = await supabase
      .from('activity_templates')
      .select('id')
      .eq('name', activityName)
      .single()

    const { data: newActivity } = await supabase
      .from('activities')
      .insert({ user_id: userId, template_id: template?.id || null, name: activityName })
      .select()
      .single()
    userActivity = newActivity
  }

  // v2.4.283 (dedup-consolidatie): gemigreerd naar de generieke Source
  // Priority Policy (v2.4.278) i.p.v. een hardcoded "check alleen
  // Concept2, alleen voor Roeien"-regel (v2.4.222). Nu: elke bestaande
  // activiteit VAN DEZELFDE SPORT die dag (`activity_id`, niet zomaar
  // elke activiteit die dag — anders zou bijv. een Concept2-Rowing-
  // sessie ten onrechte een Strava-Cycling-import kunnen blokkeren) met
  // een gelijke-of-hogere source-prioriteit dan 'strava' (80) blokkeert
  // de import. Bewust uitgebreid naar ALLE sporten (niet meer alleen
  // Roeien): de policy is sport-agnostisch, en met Trainer AI (10,
  // sinds v2.4.278) als mogelijke bestaande bron voor Running/Cycling/
  // Rowing geldt "device wint van in-app" nu voor alle drie, niet
  // alleen voor Roeien-tegen-Concept2.
  const { data: bestaandeMetVoorrang } = await supabase
    .from('activity_sessions').select('id, source')
    .eq('user_id', userId).eq('date', date).eq('activity_id', userActivity?.id || null)
    .neq('source', 'strava') // eigen, andere Strava-imports die dag zijn geen dedup-vraagstuk hier
  const geblokkeerdDoor = (bestaandeMetVoorrang || []).find(rij => !nieuweBronWint('strava', rij.source))
  if (geblokkeerdDoor) {
    return { imported: false, skipped: true, reason: `${geblokkeerdDoor.source}_heeft_voorrang` }
  }

  // Metrics opbouwen
  const metrics: Record<string, unknown> = {}
  if (activity.distance) metrics.distance = Math.round(activity.distance)
  if (activity.average_heartrate) metrics.avg_hr = Math.round(activity.average_heartrate)
  if (activity.max_heartrate) metrics.max_hr = Math.round(activity.max_heartrate)
  if (activity.total_elevation_gain) metrics.elevation = Math.round(activity.total_elevation_gain)
  if (activity.average_speed) metrics.avg_speed = Math.round(activity.average_speed * 3.6 * 10) / 10
  if (activity.kilojoules) metrics.calories = Math.round(activity.kilojoules * 0.239)
  if (activity.average_watts) metrics.avg_watts = Math.round(activity.average_watts)
  if (activity.weighted_average_watts) metrics.weighted_avg_watts = Math.round(activity.weighted_average_watts)
  if (activity.average_cadence) metrics.avg_cadence = Math.round(activity.average_cadence)

  const { data: session, error } = await supabase
    .from('activity_sessions')
    .insert({
      user_id: userId,
      activity_id: userActivity?.id || null,
      date,
      duration: Math.round(activity.moving_time / 60),
      metrics,
      source: 'strava',
      notes: 'strava:' + activity.id,
    })
    .select('id')
    .single()

  if (error) throw error

  // v2.4.284 (Source Priority Policy, punt 17 uit de Final
  // Architecture Update): de blokkeer-check hierboven voorkomt dat
  // Strava zichzelf importeert als er al een hogere/gelijke prioriteit
  // bestaat — maar ruimde tot nu toe nooit een bestaande, LAGERE
  // prioriteit op (bijv. een Trainer AI Activity Bridge-rij) na een
  // succesvolle Strava-import. Concept2 deed dit al wel (v2.4.222/283)
  // — hier ontbrak het, gevonden bij expliciete verificatie, niet
  // aangenomen dat het al klopte. Zonder deze opruiming zouden een
  // Trainer AI-rij én een latere Strava-rij voor dezelfde dag naast
  // elkaar blijven bestaan.
  if (userActivity?.id) {
    const { data: teVerwijderen } = await supabase
      .from('activity_sessions').select('id, source')
      .eq('user_id', userId).eq('date', date).eq('activity_id', userActivity.id)
      .neq('source', 'strava')
    const idsOmTeVerwijderen = (teVerwijderen || [])
      .filter(rij => nieuweBronWint('strava', rij.source))
      .map(rij => rij.id)
    if (idsOmTeVerwijderen.length > 0) {
      await supabase.from('activity_sessions').delete().in('id', idsOmTeVerwijderen)
    }
  }

  const duurMinuten = Math.round(activity.moving_time / 60)
  const sportSleutel = ACTIVITEIT_NAAR_SPORT_SLEUTEL[activityName]

  // v2.4.273 (Workout Matching Service, Fase 3 — zie
  // docs/workout-completion-platform-adr-v1.md): eerste ingest-route
  // die daadwerkelijk aangesloten is op de Matching Service (Fase 1/2
  // waren tot nu toe alleen bereikbaar via het debug-scherm of
  // Concept2). Alleen voor sporten met een matcher in de registry
  // (Rowing/Running/Cycling — Strength bewust geblokkeerd, zie
  // README). Bewust in een eigen try/catch, los van de Universal
  // Athlete State-koppeling hieronder: matching mag nooit de import
  // zelf laten falen, en mag ook niet meeliften op de
  // MINIMUM_SESSIE_DUUR_MINUTEN-drempel hieronder — die drempel is
  // specifiek bedoeld om het athlete-state-gemiddelde te beschermen
  // tegen te korte sessies, geen reden om matching over te slaan (een
  // te korte activiteit faalt de duur-tolerantie in de matcher toch
  // vanzelf al).
  if (session?.id && sportSleutel && SPORT_MATCHERS[sportSleutel]) {
    try {
      await matchActiviteitAanPlan(
        { id: session.id, userId, sport: sportSleutel, date, durationMinutes: duurMinuten, metrics },
        SPORT_MATCHERS[sportSleutel],
      )
    } catch (matchErr) {
      console.error('[strava-activity-processor] Workout matching mislukt (import zelf blijft werken):', matchErr)
    }
  }

  // Hartslag opslaan in health_metrics indien beschikbaar
  if (activity.average_heartrate) {
    await supabase.from('health_metrics').upsert({
      user_id: userId,
      date,
      resting_hr: null,
      source: 'strava',
    }, { onConflict: 'user_id,date', ignoreDuplicates: true })
  }

  // v2.4.243 (Universal Athlete Platform): als deze sport een impact-
  // adapter heeft, wordt de Universal Athlete State bijgewerkt. Bewust
  // in een try/catch — een fout hier mag de Strava-import zelf (de
  // kernfunctionaliteit) nooit laten falen, zelfde voorzichtigheids-
  // principe als bij de Concept2-sync-koppeling.
  const impactAdapter = IMPACT_ADAPTERS[activityName]
  // v2.4.273: duurMinuten/sportSleutel niet meer hier gedeclareerd —
  // staan nu hoger in de functie (nodig voor de matching-aanroep die
  // vóór dit blok gebeurt), hier alleen hergebruikt.
  // v2.4.246-FIX: zelfde drempel als Concept2/terugvullen — een zeer
  // korte sessie (bijv. per ongeluk gestarte tracking) mag het
  // gemiddelde niet onterecht naar beneden trekken
  if (impactAdapter && duurMinuten >= MINIMUM_SESSIE_DUUR_MINUTEN) {
    try {
      const huidigeState = await haalAthleteState(supabase, userId)

      // v2.4.258-FIX: gemeld — weer werd toegepast zonder te checken of
      // de sessie wel BUITEN was. Nu: alleen bij bevestigd buiten
      // (trainer !== true, en niet VirtualRide als extra zekerheid,
      // want dat is per definitie indoor/Zwift, ongeacht wat 'trainer'
      // zegt). Bij twijfel (trainer-veld ontbreekt/onbekend): WEL
      // toepassen — de meerderheid van Strava-activiteiten is buiten,
      // dus dat is de veiligere default dan structureel niets doen.
      const isIndoor = activity.trainer === true || activity.sport_type === 'VirtualRide'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
      const huidigWeer = isIndoor ? null : await haalHuidigWeer(appUrl)
      const weerBijdragen = huidigWeer && sportSleutel ? vertaalWeerNaarImpact(huidigWeer, sportSleutel) : []

      const bijdragen = [...impactAdapter(duurMinuten), ...weerBijdragen]
      const nieuweState = pasImpactToe(huidigeState, bijdragen)

      // v2.4.256 (Learning Rules Engine — daadwerkelijk toegepast)
      let stateOmOpTeSlaan = nieuweState
      if (sportSleutel) {
        const { data: geleerdePatronenData } = await supabase
          .from('learned_patterns').select('effect_pad, aanpassing_percentage').eq('user_id', userId).eq('sport', sportSleutel)
        const geleerdePatronen: GeleerdPatroon[] = geleerdePatronenData || []
        stateOmOpTeSlaan = pasGeleerdeAanpassingenToe(nieuweState, geleerdePatronen)
      }
      await slaAthleteStateOp(supabase, userId, stateOmOpTeSlaan)

      // v2.4.253 (Learning Rules Engine — daadwerkelijke koppeling)
      if (sportSleutel) await evalueerEnBewaarLeerpatronenIndienNodig(userId, sportSleutel)
    } catch (athleteStateErr) {
      console.error('[strava-activity-processor] Universal Athlete State bijwerken mislukt (import zelf blijft werken):', athleteStateErr)
    }
  }

  return { imported: true, skipped: false, activity_session_id: session?.id }
}

/**
 * Haalt een Strava-activiteit op via de API met een bestaand access token.
 */
export async function fetchStravaActivity(
  activityId: number,
  accessToken: string
): Promise<StravaActivity | null> {
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  return res.json()
}

export { SPORT_TYPE_MAP }
