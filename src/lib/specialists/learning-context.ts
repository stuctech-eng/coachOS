import { createAdminClient } from '@/lib/supabase'
import type { LearningContext } from '@/core/athlete-platform/learning-rules-engine'

// ── Learning Rules Engine — Context-verzameling ──────────────────────────
// Bron: overleg 3 augustus 2026 — Learning Rules Engine (v2.4.236) was
// volledig gebouwd en getest, maar werd door niets aangeroepen (gevonden
// tijdens de systematische controle, v2.4.251, en vastgelegd in het
// Openstaande Punten-overzicht). Dit bestand is de ontbrekende schakel:
// verzamelt de ECHTE LearningContext uit al-bestaande tabellen, geen
// nieuwe databron nodig.
//
// EERLIJKE VEREENVOUDIGINGEN, expliciet benoemd (matcht de "geen
// verborgen aannames"-afspraak):
// 1. recoveryTrendVsBaseline vergelijkt de recovery_score van de dag NA
//    een sessie van deze sport, tegen het algehele gemiddelde over alle
//    dagen. Geen gecontroleerde vergelijking (bijv. gecorrigeerd voor
//    slaap/stress die dag) — een eenvoudige, uitlegbare proxy.
// 2. rpeStabiel vergt minimaal 5 RPE-beoordelingen (training_results.
//    perceived_effort) om iets te kunnen zeggen. Concept2-sessies
//    hebben zelden een RPE (ze komen automatisch binnen, niet via de
//    "voltooi training"-flow die om een beoordeling vraagt) — bij
//    onvoldoende data: rpeStabiel = false (conservatief, claimt geen
//    stabiliteit zonder bewijs).

const SPORT_ACTIVITEIT_NAAM: Record<string, string> = { rowing: 'Roeien', running: 'Hardlopen', cycling: 'Fietsen' }
const MINIMUM_RPE_METINGEN = 5
const MAX_STABIELE_STANDAARDDEVIATIE = 1.5 // op een 1-10-schaal

export async function haalLearningContext(userId: string, sport: string): Promise<LearningContext> {
  const supabase = createAdminClient()
  const activiteitNaam = SPORT_ACTIVITEIT_NAAM[sport]

  const [sessiesRes, dailyStatusRes, rpeRes] = await Promise.all([
    supabase.from('activity_sessions').select('date, activities!inner(name)').eq('user_id', userId).eq('activities.name', activiteitNaam),
    supabase.from('daily_status').select('date, recovery_score').eq('user_id', userId).not('recovery_score', 'is', null),
    supabase.from('training_results').select('perceived_effort').eq('user_id', userId).eq('training_type', sport).not('perceived_effort', 'is', null),
  ])

  const sessieDatums = new Set((sessiesRes.data || []).map(s => s.date))
  const aantalSessies = sessieDatums.size

  // Recovery-trend: vergelijk recovery_score op de dag ná een sessie
  // van deze sport, tegen het algehele gemiddelde
  const alleRecoveryScores = (dailyStatusRes.data || []).map(d => d.recovery_score as number)
  const algemeenGemiddelde = alleRecoveryScores.length > 0 ? alleRecoveryScores.reduce((a, b) => a + b, 0) / alleRecoveryScores.length : null

  const recoveryNaSessieDagen: number[] = []
  const dailyStatusPerDatum = new Map((dailyStatusRes.data || []).map(d => [d.date, d.recovery_score as number]))
  for (const sessieDatum of sessieDatums) {
    const volgendeDag = new Date(sessieDatum)
    volgendeDag.setDate(volgendeDag.getDate() + 1)
    const volgendeDagStr = volgendeDag.toISOString().split('T')[0]
    const score = dailyStatusPerDatum.get(volgendeDagStr)
    if (score !== undefined) recoveryNaSessieDagen.push(score)
  }
  const gemiddeldeRecoveryNaSessie = recoveryNaSessieDagen.length > 0 ? recoveryNaSessieDagen.reduce((a, b) => a + b, 0) / recoveryNaSessieDagen.length : null

  const recoveryTrendVsBaseline = (gemiddeldeRecoveryNaSessie !== null && algemeenGemiddelde !== null)
    ? Math.round((gemiddeldeRecoveryNaSessie - algemeenGemiddelde) * 10) / 10
    : 0 // geen data = neutraal, geen aanname van een positieve of negatieve trend

  // RPE-stabiliteit: minimaal 5 metingen nodig, anders conservatief false
  const rpeWaarden = (rpeRes.data || []).map(r => r.perceived_effort as number)
  let rpeStabiel = false
  if (rpeWaarden.length >= MINIMUM_RPE_METINGEN) {
    const gemiddelde = rpeWaarden.reduce((a, b) => a + b, 0) / rpeWaarden.length
    const variantie = rpeWaarden.reduce((som, w) => som + (w - gemiddelde) ** 2, 0) / rpeWaarden.length
    const standaardDeviatie = Math.sqrt(variantie)
    rpeStabiel = standaardDeviatie <= MAX_STABIELE_STANDAARDDEVIATIE
  }

  return { sport, aantalSessies, recoveryTrendVsBaseline, rpeStabiel }
}
