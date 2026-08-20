// ── Recovery Intelligence — Context Formatter ───────────────────────────
// v2.4.328. De ENIGE plek waar Recovery Intelligence-data de Coach-
// prompt bereikt. Puur tekstopbouw — geen classificatie, geen
// berekening (die is al gebeurd in pattern-detection.ts). Gaat NOOIT
// de AdaptationSignal-keten in (Fase 5's kerncorrectie) — dit is een
// apart, informatief contextblok, exact zoals het bestaande
// garminContext-blok in api/coach/route.ts.

import { SupabaseClient } from '@supabase/supabase-js'

const CONFIDENCE_TIER_MINIMUM_VOOR_COACH = ['patroon', 'sterk_patroon']
const STALE_MAANDEN = 6 // Fase 6, punt 12, herzien (Fase 7.1): "geen recente bevestiging", niet "ongeldig"

/**
 * Haalt actieve, voldoende-onderbouwde patronen op en formatteert ze
 * tot een kort, neutraal contextblok. Retourneert lege string als er
 * niets te tonen is (Fase 6, punt 8 — stilte is de juiste keuze bij
 * onvoldoende bewijs, geen halve informatie).
 */
export async function bouwRecoveryIntelligenceContext(supabase: SupabaseClient, userId: string): Promise<string> {
  const zesMaandenGeleden = new Date(Date.now() - STALE_MAANDEN * 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: patronen, error } = await supabase
    .from('ri_patterns')
    .select('pattern_type, description, confidence_tier, last_confirmed_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('confidence_tier', CONFIDENCE_TIER_MINIMUM_VOOR_COACH)
    .gte('last_confirmed_at', zesMaandenGeleden) // "geen recente bevestiging" → niet actief tonen
    .order('last_confirmed_at', { ascending: false })

  if (error || !patronen || patronen.length === 0) return ''

  const regels = patronen.map(p => {
    const kwalificatie = p.confidence_tier === 'sterk_patroon' ? 'Sterk individueel patroon' : 'Patroon'
    return `- ${kwalificatie}: ${p.description}`
  })

  // v2.4.328 (Fase 5/6 — harde veiligheidsregel, letterlijk overgenomen):
  // nooit diagnostische taal, nooit een impliciete diagnose via een
  // ander woord. De instructie hieronder is net zo hard als de
  // bestaande "GEEN AANPASSING"-regel bij Coach Decision Integrity.
  return `\nRECOVERY INTELLIGENCE (uitsluitend context, GEEN beslissing — de Adjustment Engine hierboven bepaalt de daadwerkelijke trainingsaanpassing, dit blok NIET):\n${regels.join('\n')}\nDit zijn patronen op basis van herhaalde, vergelijkbare waarnemingen bij deze specifieke gebruiker — GEEN diagnose, ook niet onder een andere naam. Je mag dit noemen ter uitleg (bijv. "dit past bij een patroon dat we eerder bij jou zagen"), maar NOOIT hieruit zelf een trainingsduur, -intensiteit of andere parameter afleiden — dat blijft uitsluitend de taak van de Adjustment Engine.\n`
}
