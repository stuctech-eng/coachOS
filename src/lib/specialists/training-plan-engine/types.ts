// ── Training Plan Engine — gedeeld type-contract ────────────────────────
// Bron: overleg 19 juli 2026. De Training Plan Engine is een
// PLATFORMCOMPONENT, geen Cycling-component. Alle algemene algoritmen
// (periodisering, mesocycli, deload, adaptieve aanpassingen) horen hier
// in de Core. Sportspecifieke verschillen komen UITSLUITEND via een
// TrainingPlanSportAdapter — nooit door de Core zelf te vertakken op
// sport.

export type MesocycleType = 'basis' | 'opbouw' | 'piek' | 'herstel'

export interface MesocycleWeek {
  week_nummer: number
  type: MesocycleType
  week_load_uren: number
}

export interface GegenereerdePlanResultaat {
  plan_id: string
  start_date: string
  end_date: string
  mesocycli: MesocycleWeek[]
  aantal_sessies_aangemaakt: number
  reden: string[]
}

export interface AanpassingResultaat {
  sessie_id: string
  oude_type: string
  nieuwe_type: string | null
  reason: 'missed_session' | 'fatigue_detected' | 'injury_protection' | 'goal_change'
}

/**
 * Alles wat een sport-specifieke laag moet leveren aan de Core. Geen
 * enkele sportnaam-check hoort in de Core zelf — die roept alleen deze
 * interface aan.
 */
/**
 * Menselijke uitleg per reason code — beschrijft de BESLISSINGSMECHANIEK
 * (waarom een sessie is aangepast), niet iets sportspecifieks. Daarom
 * hier in de Core i.p.v. gedupliceerd per Coach-uitleglaag-route.
 */
export const REASON_CODE_UITLEG: Record<string, string> = {
  missed_session: 'een eerder geplande training is gemist en is verplaatst naar vandaag',
  fatigue_detected: 'de herstelwaarden van vandaag waren laag, de geplande zware training is verzacht',
  injury_protection: 'er is een actieve blessure — intensieve training is vervangen door een veiligere variant',
  vacation_mode: 'onbeschikbare dagen zijn verwerkt in het schema',
  goal_change: 'het doel is gewijzigd, het hele trainingsplan is opnieuw opgebouwd',
}

export interface TrainingPlanSportAdapter {
  /** Opgeslagen in training_plan_sessions.sport */
  sport: string
  /** specialist_profiles.specialist_type + Goal Engine-scope */
  specialistType: string
  /** Sessietype dat als "hoge intensiteit" geldt voor de CoachPolicy-gate en vermoeidheid-trigger */
  hoogIntensiteitsType: string
  /** Vervangend type bij CoachPolicy-verbod of blessurebescherming (injury_protection) */
  vervangingBijBeperking: string
  /** Vervangend type bij gedetecteerde vermoeidheid (fatigue_detected) */
  vervangingBijVermoeidheid: string

  haalProfiel(userId: string): Promise<{ trainingsdagen: string[]; beschikbare_uren_per_week: number }>
  /** Gemiddeld aantal uren/week over de laatste periode, voor de "te snelle opbouw"-verzachting */
  haalHuidigeWekelijkseUren(userId: string): Promise<number>
  /** Sport-specifieke dag-sessietype-verdeling, per mesocyclus-type */
  verdeelSessieTypen(trainingsdagen: string[], mesocycleType: MesocycleType): Array<{ dag: string; type: string }>
}
