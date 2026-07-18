export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'
import { beslisTussenSpecialisten } from '@/lib/specialists/decision-engine'
import { haalGoalsMetProgress, type GoalImportance, type CalculatedUrgency } from '@/lib/specialists/goal-engine'

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

// ── Testroute voor de Decision Engine (v2.4.85) ─────────────────────────
// Doel: direct zichtbaar maken wat beslisTussenSpecialisten() zou
// beslissen, met ECHTE actuele data — exact dezelfde ophaal-logica als
// api/coach/route.ts (v2.4.84), maar als losse, direct testbare route.
// Geen wijziging aan het daadwerkelijke dagadvies-gedrag, puur inzicht.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const masterPolicy = await genereerCoachPolicy(user.id)

    const { data: actieveSpecialisten } = await supabase
      .from('specialist_profiles')
      .select('specialist_type')
      .eq('user_id', user.id)
      .eq('active', true)

    if (!actieveSpecialisten || actieveSpecialisten.length === 0) {
      return NextResponse.json({
        info: 'Geen actieve specialisten — Decision Engine heeft niets om te beslissen.',
        masterPolicy,
      })
    }

    const summaries = await Promise.all(
      actieveSpecialisten.map(async (s: { specialist_type: string }) => {
        const { data } = await supabase
          .from('specialist_analyses')
          .select('specialist_summary, generated_at')
          .eq('user_id', user.id)
          .eq('specialist_type', s.specialist_type)
          .not('specialist_summary', 'is', null)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return data
      })
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geldigeSummaries = summaries.filter((s): s is { specialist_summary: any; generated_at: string } => !!s?.specialist_summary)

    if (geldigeSummaries.length === 0) {
      return NextResponse.json({
        info: 'Wel actieve specialisten, maar geen enkele heeft nog een specialist_summary — genereer eerst een analyse per specialist.',
        actieve_specialisten: actieveSpecialisten.map((s: { specialist_type: string }) => s.specialist_type),
        masterPolicy,
      })
    }

    const invoerVoorBeslissing = await Promise.all(
      geldigeSummaries.map(async (s) => {
        const specialistNaam = typeof s.specialist_summary.specialist === 'string' ? s.specialist_summary.specialist : 'specialist'
        // v2.4.87, rechtzetting: importance (gebruikerskeuze) en
        // calculated_urgency (Goal Engine-berekening) apart, zichtbaar
        // voor testdoeleinden
        let hoogsteImportance: GoalImportance | undefined
        let hoogsteUrgentie: CalculatedUrgency | undefined
        let naasteDeadlineDagen: number | null | undefined
        try {
          const goals = await haalGoalsMetProgress(user.id, specialistNaam)
          const specialistDoelen = goals.filter(g => g.goal_scope === 'specialist')
          if (specialistDoelen.length > 0) {
            const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
            const urgentieRang: Record<string, number> = { critical: 3, high: 2, normal: 1, low: 0 }
            const hoogsteImportanceDoel = specialistDoelen.reduce((a, b) => importanceRang[a.importance] >= importanceRang[b.importance] ? a : b)
            const hoogsteUrgentieDoel = specialistDoelen.reduce((a, b) => urgentieRang[a.calculated_urgency] >= urgentieRang[b.calculated_urgency] ? a : b)
            hoogsteImportance = hoogsteImportanceDoel.importance
            hoogsteUrgentie = hoogsteUrgentieDoel.calculated_urgency
            const deadlines = specialistDoelen.map(g => g.dagen_resterend).filter((d): d is number => d !== null)
            naasteDeadlineDagen = deadlines.length > 0 ? Math.min(...deadlines) : null
          }
        } catch { /* geen doelen of fout — blijft undefined, geen crash */ }

        return {
          specialist: specialistNaam,
          load: s.specialist_summary.load,
          risk: s.specialist_summary.risk,
          recommendation: s.specialist_summary.recommendation,
          hoogsteImportance,
          hoogsteUrgentie,
          naasteDeadlineDagen,
        }
      })
    )

    const decision = beslisTussenSpecialisten(invoerVoorBeslissing, masterPolicy.priority)

    return NextResponse.json({
      masterPolicy,
      gebruikte_summaries: invoerVoorBeslissing,
      decision_result: decision,
      toelichting: decision
        ? `Conflict gevonden — ${decision.selectedCoach} krijgt vandaag de hoofdfocus.`
        : 'Geen conflict — alle specialisten mogen gelijkwaardig meegenomen worden (0-1 specialist actief, of geen van de regels van toepassing).',
    })
  } catch (err) {
    console.error('[specialists/decision-test]', err)
    return NextResponse.json({ error: 'Testroute mislukt' }, { status: 500 })
  }
}
