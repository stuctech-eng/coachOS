import { createAdminClient } from '@/lib/supabase'
import { berekenVermogensZones, berekenHartslagZones } from './cycling-zones'

// ── Ritanalyse — Cycling Specialist Roadmap v1.0, Fase 2f ───────────────
// VOLLEDIG DETERMINISTISCH — geen AI. Bepaalt objectief meetbare feiten
// over een rit; de AI (aparte laag, hetzelfde patroon als de Coach-
// uitleglaag uit Fase 2a) interpreteert dit pas daarna in tekst.
//
// ⚠️ EERLIJKE BEPERKING: "volgens schema" wordt bepaald door te zoeken
// naar een training_plan_session op DEZELFDE DATUM — er bestaat nog geen
// expliciete koppeling (activity_sessions → training_plan_sessions via
// completed_activity_id wordt nergens automatisch ingevuld). Bij meerdere
// fietsritten op één dag kan dit dus de verkeerde sessie matchen — een
// bekende, geaccepteerde beperking van deze eerste versie.
//
// Cadans-beoordeling volgt gangbare, publiek bekende coaching-richtlijnen
// (niet propriëtair): <70 laag, 70-95 normaal, >95 hoog.

export interface RitAnalyseResultaat {
  vermogenszone: { zone: number; naam: string } | null
  hartslagzone: { zone: number; naam: string } | null
  cadans_beoordeling: 'laag' | 'normaal' | 'hoog' | null
  volgens_schema: boolean | null // null = geen geplande sessie gevonden op deze datum
  geplande_sessie: { type: string; duration: number } | null
}

export async function analyseerRit(userId: string, activiteitId: string): Promise<RitAnalyseResultaat> {
  const supabase = createAdminClient()

  const [activiteitRes, profielRes] = await Promise.all([
    supabase.from('activity_sessions').select('date, duration, metrics').eq('id', activiteitId).eq('user_id', userId).single(),
    supabase.from('specialist_profiles').select('preferences').eq('user_id', userId).eq('specialist_type', 'cycling').maybeSingle(),
  ])

  if (activiteitRes.error || !activiteitRes.data) {
    throw new Error('Activiteit niet gevonden')
  }

  const metrics = activiteitRes.data.metrics as { avg_watts?: number; avg_hr?: number; avg_cadence?: number } | null
  const profiel = profielRes.data?.preferences as { ftp?: number; max_hartslag?: number } | null

  // ── Vermogenszone ─────────────────────────────────────────────────
  let vermogenszone: { zone: number; naam: string } | null = null
  if (metrics?.avg_watts && profiel?.ftp) {
    const zones = berekenVermogensZones(profiel.ftp)
    const match = zones.find(z => metrics.avg_watts! >= z.van_watt && (z.tot_watt === null || metrics.avg_watts! <= z.tot_watt))
    if (match) vermogenszone = { zone: match.zone, naam: match.naam }
  }

  // ── Hartslagzone ──────────────────────────────────────────────────
  let hartslagzone: { zone: number; naam: string } | null = null
  if (metrics?.avg_hr && profiel?.max_hartslag) {
    const zones = berekenHartslagZones(profiel.max_hartslag)
    const match = zones.find(z => metrics.avg_hr! >= z.van_bpm && metrics.avg_hr! <= z.tot_bpm)
    if (match) hartslagzone = { zone: match.zone, naam: match.naam }
  }

  // ── Cadans-beoordeling, gangbare richtlijn ────────────────────────
  let cadansBeoordeling: 'laag' | 'normaal' | 'hoog' | null = null
  if (metrics?.avg_cadence) {
    if (metrics.avg_cadence < 70) cadansBeoordeling = 'laag'
    else if (metrics.avg_cadence <= 95) cadansBeoordeling = 'normaal'
    else cadansBeoordeling = 'hoog'
  }

  // ── Vergelijking met het schema, op datum (zie beperking hierboven) ──
  let volgensSchema: boolean | null = null
  let geplandeSessie: { type: string; duration: number } | null = null

  const { data: actievePlannen } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', userId)
    .eq('status', 'active')
  const planIds = (actievePlannen || []).map(p => p.id)

  const { data: sessie } = planIds.length > 0
    ? await supabase
        .from('training_plan_sessions')
        .select('type, duration')
        .eq('date', activiteitRes.data.date)
        .neq('status', 'cancelled')
        .in('plan_id', planIds)
        .maybeSingle()
    : { data: null }

  if (sessie) {
    geplandeSessie = { type: sessie.type, duration: sessie.duration }
    // "Volgens schema": duur binnen 20% van het geplande, geen strengere
    // claim dan dat — puur een ruwe indicatie, geen exacte match-eis
    const marge = sessie.duration * 0.2
    volgensSchema = Math.abs(activiteitRes.data.duration - sessie.duration) <= marge
  }

  return { vermogenszone, hartslagzone, cadans_beoordeling: cadansBeoordeling, volgens_schema: volgensSchema, geplande_sessie: geplandeSessie }
}
