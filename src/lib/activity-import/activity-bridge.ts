import { createAdminClient } from '@/lib/supabase'
import { nieuweBronWint } from './source-priority-policy'
import { matchActiviteitAanPlan } from '@/lib/specialists/training-plan-engine/workout-matcher'
import { SPORT_MATCHERS } from '@/lib/specialists/training-plan-engine/matcher-registry'

// ── Activity Bridge ────────────────────────────────────────────────────────
// Bron: overleg 5 augustus 2026, CoachOS Platform Final Architecture v1.0.
// Eigen, aparte verantwoordelijkheid — "moet hier een activiteit uit
// ontstaan?" — bewust GESCHEIDEN van training/complete/route.ts, die
// alleen "de training is afgerond" registreert. Eén verantwoordelijkheid
// per component, zelfde principe als overal elders in dit platform.
//
// Alleen voor activiteitssporten (Running/Cycling/Rowing/Walking/
// Swimming) — Strength/Kettlebell/Bodyweight/Mobility blijven bewust
// bij training_results alleen (Final Architecture, expliciete regel).
//
// EERLIJKE BEPERKING: training/complete/route.ts levert geen afstand,
// hartslag of andere metrics — alleen duur. metrics blijft dus leeg
// i.p.v. iets te verzinnen. Als Garmin dezelfde training later alsnog
// importeert, wint die (hogere source-prioriteit, zie
// source-priority-policy.ts) en vervangt deze rij niet automatisch —
// zie EERLIJKE BEPERKING #2 hieronder.

const SPORT_NAAR_ACTIVITEIT_NAAM: Record<string, string> = {
  running: 'Hardlopen',
  cycling: 'Fietsen',
  rowing: 'Roeien',
  walking: 'Wandelen',
  swimming: 'Zwemmen',
}

const BRIDGE_BRON = 'trainer_ai'

export interface TrainingResultaatVoorBridge {
  trainingResultId: string
  userId: string
  trainingType: string | null
  actualDuration: number | null
  date: string // yyyy-mm-dd
}

export interface ActivityBridgeUitkomst {
  aangemaakt: boolean
  reden: string
  activiteitId?: string
}

export async function overwegActiviteitUitTrainingResultaat(
  input: TrainingResultaatVoorBridge,
): Promise<ActivityBridgeUitkomst> {
  const sportKey = input.trainingType?.toLowerCase() || ''
  const activiteitNaam = SPORT_NAAR_ACTIVITEIT_NAAM[sportKey]

  if (!activiteitNaam) {
    // Geen activiteitssport (bijv. strength/kettlebell/bodyweight) —
    // training_results blijft bewust de enige waarheid, geen brug.
    return { aangemaakt: false, reden: `'${sportKey}' is geen activiteitssport — training_results blijft voldoende` }
  }

  if (!input.actualDuration || input.actualDuration <= 0) {
    return { aangemaakt: false, reden: 'geen bruikbare duur — niets om te overbruggen' }
  }

  const supabase = createAdminClient()

  // Idempotency — dezelfde training_result mag nooit twee keer een
  // activity_session opleveren (bijv. bij een dubbele aanroep).
  const { data: bestaandeBridgeRij } = await supabase
    .from('activity_sessions')
    .select('id')
    .eq('user_id', input.userId)
    .eq('source', BRIDGE_BRON)
    .ilike('notes', `%training_result:${input.trainingResultId}%`)
    .maybeSingle()
  if (bestaandeBridgeRij) {
    return { aangemaakt: false, reden: 'al eerder overbrugd voor dit training_result', activiteitId: bestaandeBridgeRij.id }
  }

  // Zoek of deze gebruiker deze activiteitssoort al heeft
  let { data: userActivity } = await supabase
    .from('activities').select('id')
    .eq('user_id', input.userId).eq('name', activiteitNaam).maybeSingle()
  if (!userActivity) {
    const { data: template } = await supabase
      .from('activity_templates').select('id').eq('name', activiteitNaam).maybeSingle()
    const { data: newActivity } = await supabase
      .from('activities').insert({ user_id: input.userId, template_id: template?.id || null, name: activiteitNaam })
      .select().single()
    userActivity = newActivity
  }

  // ── Source Priority Policy — generieke dedup ────────────────────────
  // Zoek ALLE bestaande activity_sessions voor deze gebruiker/datum/
  // activiteit (ongeacht bron) en vergelijk elk met onze bron
  // ('trainer_ai', laagste prioriteit). Als een device-bron (Concept2/
  // Garmin/Strava) die dag al iets heeft geregistreerd, wint die altijd
  // — geen dubbele activiteit voor dezelfde training.
  const { data: bestaandeDieDag } = await supabase
    .from('activity_sessions')
    .select('id, source')
    .eq('user_id', input.userId)
    .eq('date', input.date)
    .eq('activity_id', userActivity?.id || null)

  const geblokkeerdDoor = (bestaandeDieDag || []).find(rij => !nieuweBronWint(BRIDGE_BRON, rij.source))
  if (geblokkeerdDoor) {
    return { aangemaakt: false, reden: `bestaande activiteit met hogere source-prioriteit ('${geblokkeerdDoor.source}') wint — geen dubbele registratie` }
  }

  const { data: nieuweActiviteit, error } = await supabase
    .from('activity_sessions')
    .insert({
      user_id: input.userId,
      activity_id: userActivity?.id || null,
      date: input.date,
      duration: input.actualDuration,
      // EERLIJKE BEPERKING: leeg, geen afstand/hartslag beschikbaar
      // vanuit training/complete — geen schijndata verzinnen.
      metrics: {},
      source: BRIDGE_BRON,
      notes: `training_result:${input.trainingResultId}`,
    })
    .select('id').single()

  if (error) {
    console.error('[activity-bridge] Insert mislukt:', error)
    return { aangemaakt: false, reden: `insert mislukt: ${error.message}` }
  }

  // Nu deze activiteit in het Canonical Activity Model zit, geldt
  // vanaf hier exact dezelfde flow als elke andere bron (Source
  // Isolation, ADR §2b) — inclusief een kans op Workout Matching.
  const matcher = SPORT_MATCHERS[sportKey]
  if (matcher && nieuweActiviteit) {
    try {
      await matchActiviteitAanPlan(
        { id: nieuweActiviteit.id, userId: input.userId, sport: sportKey, date: input.date, durationMinutes: input.actualDuration, metrics: {} },
        matcher,
      )
    } catch (matchErr) {
      console.error('[activity-bridge] Workout matching mislukt (bridge zelf blijft geslaagd):', matchErr)
    }
  }

  return { aangemaakt: true, reden: 'activity_session aangemaakt vanuit training_result', activiteitId: nieuweActiviteit?.id }
}
