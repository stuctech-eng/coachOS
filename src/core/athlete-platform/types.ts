// ── CoachOS Universal Athlete Platform — Universal Athlete State ────────
// Bron: Universal Athlete Platform Master Architecture, vastgelegd
// 2 augustus 2026. Eerste bouwstap: alleen het datamodel, nog GEEN
// logica (Universal Impact Engine/Learning Rules Engine volgen als
// aparte, latere stappen).
//
// KERNREGELS, niet-onderhandelbaar (letterlijk uit het ontwerpoverleg):
// 1. Dit platform is een OBSERVER — beschrijft/analyseert, beslist NOOIT
//    zelf. Beslissingen blijven bij Intelligence Platform/Master Coach.
// 2. GEEN SCHIJNPRECISIE: een los getal ("Cardio +65") wordt NOOIT aan
//    de gebruiker getoond. Elke waarde is een kwalitatief label +
//    verplichte confidence — matcht het al-bestaande Performance
//    Platform-patroon (HIGH/MEDIUM/LOW).
// 3. Confidence op ÉLKE waarde, niet alleen op een totaalscore.

/** Kwalitatief label — het enige dat de gebruiker ooit rechtstreeks ziet.
 * Nooit een los getal tonen, altijd dit label + de bijbehorende confidence. */
export type KwalitatiefNiveau = 'zeer_laag' | 'laag' | 'gemiddeld' | 'hoog' | 'zeer_hoog'

export type ConfidenceNiveau = 'HIGH' | 'MEDIUM' | 'LOW'

/** Elke universele waarde in het systeem is verplicht van dit type —
 * er bestaat geen "kale" waarde zonder confidence. `ruweWaarde` is
 * uitsluitend voor intern gebruik door engines (bijv. de Learning Rules
 * Engine's drempelberekeningen), NOOIT rechtstreeks aan de UI doorgeven. */
export interface UniverseleWaarde {
  niveau: KwalitatiefNiveau
  confidence: ConfidenceNiveau
  confidence_score: number // 0-100, voor sortering/drempels
  /** v2.4.245-FIX: aantal keer dat deze waarde is bijgewerkt met een
   * echte sessie-bijdrage. Nodig om confidence daadwerkelijk te laten
   * GROEIEN met meer data — de oorspronkelijke opzet (confidence =
   * altijd de laagste van bestaand/nieuw) zorgde ervoor dat confidence
   * nooit boven het startpunt kon uitkomen, ook niet na tientallen
   * sessies. Zie impact-engine.ts's combineerWaarde(). */
  aantal_observaties?: number
  /** Intern, voor engine-berekeningen — NOOIT rechtstreeks tonen aan de
   * gebruiker (zie Kernregel 2 hierboven) */
  ruweWaarde?: number
  /** Waarom deze confidence zo laag/hoog is — bijv. "onvoldoende data",
   * matcht het patroon uit Performance Platform's limitations-array */
  toelichting?: string
}

// ── De acht categorieën van de Universal Athlete State ───────────────────
// Bewust NOOIT sport-specifieke velden hier (geen FTP/pace/SPM) — dat
// hoort bij de Specialist Adapters, niet bij dit platformbrede model.

export interface CardiovasculaireBelasting {
  aerobic_load: UniverseleWaarde
  anaerobic_load: UniverseleWaarde
  vo2_adaptatie: UniverseleWaarde
  cardio_vermoeidheid: UniverseleWaarde
}

export interface SpierBelasting {
  been_vermoeidheid: UniverseleWaarde
  core_vermoeidheid: UniverseleWaarde
  bovenlichaam_vermoeidheid: UniverseleWaarde
  onderrug_vermoeidheid: UniverseleWaarde
  grip_vermoeidheid: UniverseleWaarde
}

export interface MechanischeBelasting {
  gewricht_impact: UniverseleWaarde
  pees_belasting: UniverseleWaarde
  bot_stress: UniverseleWaarde
  spierschade: UniverseleWaarde
}

export interface NeurologischeBelasting {
  neuromusculaire_vermoeidheid: UniverseleWaarde
  coordinatie: UniverseleWaarde
  motorische_controle: UniverseleWaarde
  explosiviteit: UniverseleWaarde
}

export interface HerstelStatus {
  herstel: UniverseleWaarde
  slaap_tekort: UniverseleWaarde
  hrv_trend: UniverseleWaarde
  rust_hartslag: UniverseleWaarde
  body_battery: UniverseleWaarde
  herstel_capaciteit: UniverseleWaarde
}

export interface MentaleStatus {
  stress: UniverseleWaarde
  motivatie: UniverseleWaarde
  focus: UniverseleWaarde
  cognitieve_vermoeidheid: UniverseleWaarde
}

export interface TrainingsBelasting {
  acute_belasting: UniverseleWaarde
  chronische_belasting: UniverseleWaarde
  acwr: UniverseleWaarde
  consistentie: UniverseleWaarde
  trainingsmonotonie: UniverseleWaarde
  trainingsspanning: UniverseleWaarde
}

export interface OmgevingsAdaptatie {
  hitte_adaptatie: UniverseleWaarde
  koude_adaptatie: UniverseleWaarde
  hoogte_adaptatie: UniverseleWaarde
  hydratatie_status: UniverseleWaarde
  energie_beschikbaarheid: UniverseleWaarde
}

/** Het digitale model van de sporter — niet van de sport.
 * Wordt gevuld/bijgewerkt door de (latere) Universal Impact Engine na
 * elke voltooide training, ongeacht welke specialist die aanleverde. */
export interface UniversalAthleteState {
  user_id: string
  laatst_bijgewerkt: string // ISO-timestamp

  cardiovasculair: CardiovasculaireBelasting
  spieren: SpierBelasting
  mechanisch: MechanischeBelasting
  neurologisch: NeurologischeBelasting
  herstel: HerstelStatus
  mentaal: MentaleStatus
  training: TrainingsBelasting
  omgeving: OmgevingsAdaptatie
}

// ── Minimum-datapunten vóór personalisatie — bewust vastgelegd ──────────
// "CoachOS weet nog niets van JOU, gebruikt algemene sportwetenschap"
// totdat de drempel gehaald is. Daarna: "CoachOS kent JOU."
export type PersonalisatieStatus = 'population_model' | 'learning_enabled'

export const MINIMUM_TRAININGEN_VOOR_LEREN: Record<string, number> = {
  running: 20, cycling: 20, rowing: 20, strength: 15,
}

export function bepaalPersonalisatieStatus(sport: string, aantalTrainingen: number): PersonalisatieStatus {
  const drempel = MINIMUM_TRAININGEN_VOOR_LEREN[sport] ?? 20
  return aantalTrainingen >= drempel ? 'learning_enabled' : 'population_model'
}
