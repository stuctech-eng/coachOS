import { createAdminClient } from '@/lib/supabase'

// ── Goal Engine ───────────────────────────────────────────────────────────
// v2.4.87 — RECHTZETTING op v2.4.86: urgency is niet langer een door de
// gebruiker ingevuld, statisch veld. Dat vermengde twee verschillende
// concepten die apart moeten blijven:
//
// - IMPORTANCE (gebruikerskeuze, stabiel, opgeslagen in user_goals):
//   hoe belangrijk vindt de gebruiker dit doel?
// - URGENCY (Goal Engine-berekening, dynamisch, NOOIT opgeslagen):
//   hoe urgent is het VANDAAG, gegeven de naderende deadline?
//
// Voorbeeld ter illustratie van waarom dit onderscheid nodig is: een
// gebruiker die "FTP 280W" als "must" markeert (importance), terwijl de
// wedstrijd nog 9 maanden weg is en herstel uitstekend gaat, heeft LAGE
// urgency vandaag — ongeacht hoe belangrijk het doel voor de gebruiker
// voelt. Urgency mag dus nooit een gebruikersinvoer zijn, alleen een
// berekening op basis van tijd (en, in een toekomstige uitbreiding,
// voortgang — zie onderaan dit bestand).
//
// Dit is consistent met "AI rekent nooit, engines bepalen de waarheid" —
// hier toegepast op tijdsdruk: niet de gebruiker of de AI bepaalt hoe
// urgent iets is, de Goal Engine berekent het deterministisch.

export type GoalImportance = 'must' | 'high' | 'normal' | 'low'
export type CalculatedUrgency = 'critical' | 'high' | 'normal' | 'low'
export type GoalScope = 'global' | 'specialist'
export type GoalDeadlineStatus = 'geen_deadline' | 'ruim_op_tijd' | 'deadline_nabij' | 'deadline_verstreken'

export interface UserGoal {
  id: string
  title: string
  goal_type: string
  goal_scope: GoalScope
  specialist_type: string | null
  importance: GoalImportance
  target_value: number | null
  current_value: number | null
  target_date: string | null
  status: string
}

export interface GoalProgressResultaat {
  goal_id: string
  title: string
  goal_scope: GoalScope
  specialist_type: string | null
  importance: GoalImportance          // gebruikerskeuze, stabiel
  calculated_urgency: CalculatedUrgency // Goal Engine-berekening, dynamisch
  dagen_resterend: number | null
  waarde_kloof: number | null // target_value - current_value, richting NIET geïnterpreteerd
  deadline_status: GoalDeadlineStatus
}

const DEADLINE_NABIJ_DAGEN = 14

// ── Urgency-berekening — puur op deadline-nabijheid ────────────────────
// Bewust NOG NIET gebaseerd op voortgang-versus-plan (zie de
// toekomstige-uitbreiding-notitie onderaan dit bestand) — dat vergt een
// vastgelegde startwaarde/-datum die nu niet bestaat. Wat hier wel al
// correct berekend wordt, is exact het voorbeeld dat leidde tot deze
// rechtzetting: "wedstrijd over 8 dagen" → critical, ongeacht wat de
// gebruiker zelf als importance had ingesteld.
function berekenCalculatedUrgency(dagenResterend: number | null): CalculatedUrgency {
  if (dagenResterend === null) return 'low' // geen deadline = geen tijdsdruk vanuit de Goal Engine
  if (dagenResterend <= 7) return 'critical'
  if (dagenResterend <= 30) return 'high'
  if (dagenResterend <= 90) return 'normal'
  return 'low'
}

export function berekenGoalProgress(goal: UserGoal): GoalProgressResultaat {
  let dagenResterend: number | null = null
  let deadlineStatus: GoalDeadlineStatus = 'geen_deadline'

  if (goal.target_date) {
    const nu = new Date()
    dagenResterend = Math.ceil((new Date(goal.target_date).getTime() - nu.getTime()) / (24 * 60 * 60 * 1000))
    if (dagenResterend < 0) deadlineStatus = 'deadline_verstreken'
    else if (dagenResterend <= DEADLINE_NABIJ_DAGEN) deadlineStatus = 'deadline_nabij'
    else deadlineStatus = 'ruim_op_tijd'
  }

  const waardeKloof = (goal.target_value !== null && goal.current_value !== null)
    ? Math.round((goal.target_value - goal.current_value) * 10) / 10
    : null

  return {
    goal_id: goal.id,
    title: goal.title,
    goal_scope: goal.goal_scope,
    specialist_type: goal.specialist_type,
    importance: goal.importance,
    calculated_urgency: berekenCalculatedUrgency(dagenResterend),
    dagen_resterend: dagenResterend,
    waarde_kloof: waardeKloof,
    deadline_status: deadlineStatus,
  }
}

/**
 * Haalt actieve doelen op met hun berekende voortgang. Filter-opties:
 * - specialistType opgegeven: geeft specialist-doelen van DIE specialist
 *   + alle global-doelen (specialisten mogen global-context zien)
 * - specialistType weggelaten: geeft ALLE doelen (voor de Master Coach)
 */
export async function haalGoalsMetProgress(
  userId: string,
  specialistType?: string
): Promise<GoalProgressResultaat[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('user_goals')
    .select('id, title, goal_type, goal_scope, specialist_type, importance, target_value, current_value, target_date, status')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (specialistType) {
    query = query.or(`goal_scope.eq.global,and(goal_scope.eq.specialist,specialist_type.eq.${specialistType})`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data || []).map((g: UserGoal) => berekenGoalProgress(g))
}

// ── Toekomstige uitbreiding, NIET nu gebouwd (bewust, eerlijk vastgelegd) ──
// Zoals in het vervolgoverleg voorgesteld: urgency zou uiteindelijk ook
// voortgang-versus-plan moeten meewegen (op schema / voor op schema /
// achter op schema, kans op behalen, benodigde trainingsbelasting,
// verwachte einddatum). Dit vergt een vastgelegde startwaarde en
// startdatum per doel, die nu niet bestaan in het datamodel — zonder die
// basis zou een "op schema"-claim gegokt zijn, niet berekend. Pas te
// bouwen zodra dat is opgelost (bijv. door bij het aanmaken van een doel
// de startwaarde/-datum vast te leggen).
