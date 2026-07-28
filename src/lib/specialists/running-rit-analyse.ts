import { createAdminClient } from '@/lib/supabase'
import { berekenVDOT, berekenPaceZones } from './running-zones'
import { berekenHartslagZones } from './cycling-zones'
import { berekenDrempelsnelheidKmh, berekenGeschatteRunningTSS } from './running-grafieken'
import { genereerCoachPolicy } from './coach-policy'

// ── Running Ritanalyse — Fase 2 (Professional) ──────────────────────────
// Bron: overleg 22 juli 2026. Zelfde principe als cycling-rit-analyse.ts
// (Fase 2f): VOLLEDIG DETERMINISTISCH — geen AI. Uitgebreider dan de
// Cycling-versie qua categorieën (Prestatie/Techniek/Belasting), op
// uitdrukkelijk verzoek, zodat Running direct op hetzelfde niveau
// begint i.p.v. later te moeten bijbouwen.
//
// EERLIJKE BEPERKING, bewust NIET gebouwd: verticale oscillatie,
// grondcontacttijd, paslengte — deze velden worden nergens uit TCX
// geparsed (geen namespace-tags voor gevonden/getest tegen een echt
// bestand). Altijd null, expliciet zo gelabeld — geen gok-implementatie
// zonder een echt voorbeeld om tegen te testen.
//
// Cadans-richtlijn (170-180 spm als gangbaar "goed" bereik) is een
// publiek, wijdverspreid geciteerde vuistregel (o.a. Jack Daniels'
// Running Formula) — geen propriëtaire claim.

export interface RunningRitAnalyseResultaat {
  // Zones
  pacezone: { naam: string; pace_sec_per_km: number } | null
  hartslagzone: { zone: number; naam: string } | null
  cadans_beoordeling: 'laag' | 'normaal' | 'hoog' | null

  // Prestatie
  gemiddelde_pace_sec_per_km: number | null
  beste_pace_sec_per_km: number | null
  split: { type: 'negative_split' | 'positive_split' | 'gelijkmatig'; verschil_pct: number; pacing_consistentie_score: number } | null
  hoogtemeters: number | null
  gemiddelde_hartslag: number | null
  max_hartslag: number | null

  // Techniek
  cadans_score: number | null // 0-100, hoe dicht bij het 170-180 spm-richtwaardebereik
  running_power_watt: number | null // alleen als het horloge/sensor dit levert

  // Belasting
  geschatte_tss: number | null
  intensity_factor: number | null
  coach_policy_conclusie: { recoveryState: string; maxIntensity: string } | null

  // Vergelijking met schema
  volgens_schema: boolean | null
  geplande_sessie: { type: string; duration: number } | null
  // v2.4.177-FIX: zelfde fout gevonden als bij Cycling — AI kreeg geen
  // werkelijke duur te horen, moest zelf "korter"/"langer" bedenken
  werkelijke_duur_minuten: number
  afwijking_richting: 'korter' | 'langer' | null
}

function cadansNaarBeoordelingEnScore(cadans: number): { beoordeling: 'laag' | 'normaal' | 'hoog'; score: number } {
  let beoordeling: 'laag' | 'normaal' | 'hoog'
  if (cadans < 160) beoordeling = 'laag'
  else if (cadans <= 185) beoordeling = 'normaal'
  else beoordeling = 'hoog'

  // Score: hoe dicht bij het midden van het 170-180-richtwaardebereik,
  // met een geleidelijke afname naar de randen — geen harde knip
  const midden = 175
  const afstandTotMidden = Math.abs(cadans - midden)
  const score = Math.round(Math.max(0, Math.min(100, 100 - afstandTotMidden * 2.5)))
  return { beoordeling, score }
}

export async function analyseerRunningRit(userId: string, activiteitId: string): Promise<RunningRitAnalyseResultaat> {
  const supabase = createAdminClient()

  const [activiteitRes, profielRes, policy] = await Promise.all([
    supabase.from('activity_sessions').select('date, duration, metrics').eq('id', activiteitId).eq('user_id', userId).single(),
    supabase.from('specialist_profiles').select('preferences').eq('user_id', userId).eq('specialist_type', 'running').maybeSingle(),
    genereerCoachPolicy(userId).catch(() => null),
  ])

  if (activiteitRes.error || !activiteitRes.data) {
    throw new Error('Activiteit niet gevonden')
  }

  const metrics = activiteitRes.data.metrics as {
    avg_speed?: number; max_speed?: number; avg_hr?: number; max_hr?: number
    avg_cadence?: number; elevation_gain?: number; avg_watts?: number
    split_analyse?: { type: 'negative_split' | 'positive_split' | 'gelijkmatig'; verschil_pct: number; pacing_consistentie_score: number } | null
  } | null

  const prefs = profielRes.data?.preferences as { laatste_race_afstand_m?: number; laatste_race_tijd_sec?: number; max_hartslag?: number } | null
  const vdot = prefs?.laatste_race_afstand_m && prefs?.laatste_race_tijd_sec
    ? berekenVDOT(prefs.laatste_race_afstand_m, prefs.laatste_race_tijd_sec)
    : null

  const secPerKm = (kmh: number) => Math.round(3600 / kmh)

  // ── Pace-zone ────────────────────────────────────────────────────────
  let pacezone: { naam: string; pace_sec_per_km: number } | null = null
  const gemPaceSecPerKm = metrics?.avg_speed ? secPerKm(metrics.avg_speed) : null
  if (gemPaceSecPerKm && vdot) {
    const zones = berekenPaceZones(vdot)
    // pace_tot = snelste rand (laagste sec/km), pace_van = langzaamste rand (hoogste sec/km)
    const match = zones.find(z => gemPaceSecPerKm <= z.pace_van_sec_per_km && gemPaceSecPerKm >= z.pace_tot_sec_per_km)
    if (match) pacezone = { naam: match.naam, pace_sec_per_km: gemPaceSecPerKm }
  }

  // ── Hartslagzone ─────────────────────────────────────────────────────
  let hartslagzone: { zone: number; naam: string } | null = null
  if (metrics?.avg_hr && prefs?.max_hartslag) {
    const zones = berekenHartslagZones(prefs.max_hartslag)
    const match = zones.find(z => metrics.avg_hr! >= z.van_bpm && metrics.avg_hr! <= z.tot_bpm)
    if (match) hartslagzone = { zone: match.zone, naam: match.naam }
  }

  // ── Cadans ───────────────────────────────────────────────────────────
  let cadansBeoordeling: 'laag' | 'normaal' | 'hoog' | null = null
  let cadansScore: number | null = null
  if (metrics?.avg_cadence) {
    const { beoordeling, score } = cadansNaarBeoordelingEnScore(metrics.avg_cadence)
    cadansBeoordeling = beoordeling
    cadansScore = score
  }

  // ── Belasting: TSS/IF (alleen te berekenen met een bekende VDOT) ──────
  let geschatteTss: number | null = null
  let intensityFactor: number | null = null
  if (vdot && metrics?.avg_speed) {
    const drempelsnelheid = berekenDrempelsnelheidKmh(vdot)
    geschatteTss = berekenGeschatteRunningTSS(activiteitRes.data.duration || 0, metrics.avg_speed, drempelsnelheid)
    intensityFactor = drempelsnelheid > 0 ? Math.round((metrics.avg_speed / drempelsnelheid) * 100) / 100 : null
  }

  // ── Vergelijking met het schema, op datum (zelfde beperking als Cycling) ──
  let volgensSchema: boolean | null = null
  let geplandeSessie: { type: string; duration: number } | null = null

  const { data: actievePlannen } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', userId)
    .eq('sport', 'running')
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

  let afwijkingRichting: 'korter' | 'langer' | null = null

  if (sessie) {
    geplandeSessie = { type: sessie.type, duration: sessie.duration }
    const marge = sessie.duration * 0.2
    volgensSchema = Math.abs(activiteitRes.data.duration - sessie.duration) <= marge
    if (!volgensSchema) {
      afwijkingRichting = activiteitRes.data.duration > sessie.duration ? 'langer' : 'korter'
    }
  }

  return {
    pacezone,
    hartslagzone,
    cadans_beoordeling: cadansBeoordeling,
    gemiddelde_pace_sec_per_km: gemPaceSecPerKm,
    beste_pace_sec_per_km: metrics?.max_speed ? secPerKm(metrics.max_speed) : null,
    split: metrics?.split_analyse
      ? { type: metrics.split_analyse.type, verschil_pct: metrics.split_analyse.verschil_pct, pacing_consistentie_score: metrics.split_analyse.pacing_consistentie_score }
      : null,
    hoogtemeters: metrics?.elevation_gain ?? null,
    gemiddelde_hartslag: metrics?.avg_hr ?? null,
    max_hartslag: metrics?.max_hr ?? null,
    cadans_score: cadansScore,
    running_power_watt: metrics?.avg_watts ?? null,
    geschatte_tss: geschatteTss,
    intensity_factor: intensityFactor,
    coach_policy_conclusie: policy ? { recoveryState: policy.recoveryState, maxIntensity: policy.maxIntensity } : null,
    volgens_schema: volgensSchema,
    geplande_sessie: geplandeSessie,
    werkelijke_duur_minuten: activiteitRes.data.duration,
    afwijking_richting: afwijkingRichting,
  }
}
