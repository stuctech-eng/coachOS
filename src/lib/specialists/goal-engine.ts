import { createAdminClient } from '@/lib/supabase'

// ── Goal Engine ───────────────────────────────────────────────────────────
// Bron: vervolgoverleg op specialist-api.md v2.4.72 (Global vs. Specialist
// Goals). VOLLEDIG DETERMINISTISCH — geen AI.
//
// Bewust EERLIJK BEGRENSD: dit berekent wat daadwerkelijk uit de data valt
// af te leiden (dagen tot deadline, de ruwe kloof tussen huidige en
// streefwaarde) — het claimt NIET te weten of de gebruiker "op schema"
// ligt in de zin van een verwachte lineaire voortgangscurve, want daarvoor
// ontbreekt een vastgelegde startwaarde/-datum. Het claimt ook niet welke
// richting (omhoog/omlaag) "goed" is voor een doel (bijv. afvallen wil een
// dalende current_value, kracht opbouwen een stijgende) — die interpretatie
// hoort bij de AI, die de doeltitel in natuurlijke taal kan lezen.

export type GoalUrgency = 'critical' | 'high' | 'normal' | 'low'
export type GoalScope = 'global' | 'specialist'
export type GoalDeadlineStatus = 'geen_deadline' | 'ruim_op_tijd' | 'deadline_nabij' | 'deadline_verstreken'

export interface UserGoal {
  id: string
  title: string
  goal_type: string
  goal_scope: GoalScope
  specialist_type: string | null
  urgency: GoalUrgency
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
  urgency: GoalUrgency
  dagen_resterend: number | null
  waarde_kloof: number | null // target_value - current_value, richting NIET geïnterpreteerd
  deadline_status: GoalDeadlineStatus
}

const DEADLINE_NABIJ_DAGEN = 14

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
    urgency: goal.urgency,
    dagen_resterend: dagenResterend,
    waarde_kloof: waardeKloof,
    deadline_status: deadlineStatus,
  }
}

/**
 * Haalt actieve doelen op met hun berekende voortgang. Filter-opties:
 * - specialistType opgegeven: geeft specialist-doelen van DIE specialist
 *   + alle global-doelen (specialisten mogen global-context zien, bijv.
 *   "afvallen" is relevant voor elke sport-context)
 * - specialistType weggelaten: geeft ALLE doelen (voor de Master Coach)
 */
export async function haalGoalsMetProgress(
  userId: string,
  specialistType?: string
): Promise<GoalProgressResultaat[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('user_goals')
    .select('id, title, goal_type, goal_scope, specialist_type, urgency, target_value, current_value, target_date, status')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (specialistType) {
    // (goal_scope='global') OR (goal_scope='specialist' AND specialist_type=X)
    query = query.or(`goal_scope.eq.global,and(goal_scope.eq.specialist,specialist_type.eq.${specialistType})`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data || []).map((g: UserGoal) => berekenGoalProgress(g))
}
