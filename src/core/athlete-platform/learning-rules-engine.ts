import { bepaalPersonalisatieStatus, type PersonalisatieStatus } from './types'

// ── CoachOS Universal Athlete Platform — Learning Rules Engine ──────────
// Bron: Universal Athlete Platform Master Architecture, 2 augustus 2026.
// BEWUST NIET "AI" genoemd — dit is een expliciete, uitlegbare regel-
// engine, geen black box. Elke regel: if-conditie → effect, volledig
// reproduceerbaar en testbaar. Zelfde filosofie als elke andere engine
// die vandaag gebouwd is (Training Plan Engine, Workout Platform).
//
// NIET TE VERWARREN met src/lib/specialists/learning-engine.ts (Coach
// Memory — AI-gegenereerde "kandidaat-inzichten" voor coach-gesprekken,
// bijv. "gebruiker doet het beter met 3 rustdagen"). Dit hier is iets
// anders: statistische, regelgebaseerde patronen op de Universal
// Athlete State, geen AI-tekst, geen conversatie-geheugen.
//
// KERNREGEL: ontdekt patronen, NEEMT ZELF GEEN BESLISSINGEN. Het effect
// van een vurende regel is een voorstel — Intelligence Platform (latere
// stap) bepaalt wat ermee gebeurt.
//
// Personalisatie pas ingeschakeld ná de minimum-datapunten-drempel uit
// types.ts (bepaalPersonalisatieStatus) — vóór die tijd draait er
// helemaal geen regel, om overtuigde, foute personalisatie op toeval
// te voorkomen ("Population Model" i.p.v. "Learning Enabled").

export interface LearningContext {
  sport: string
  aantalSessies: number
  /** Herstel-trend t.o.v. een baseline — positief = herstelt beter dan
   * verwacht na deze sportbelasting, negatief = slechter */
  recoveryTrendVsBaseline: number
  /** Hoe stabiel de ervaren inspanning (RPE) is over de laatste sessies
   * — een lage variantie betekent voorspelbare, betrouwbare data */
  rpeStabiel: boolean
}

export interface LearningRuleEffect {
  /** Dot-pad, zelfde adressering als de Universal Impact Engine */
  pad: string
  /** Percentage-aanpassing, bijv. +4 betekent "verhoog deze factor met 4%" */
  aanpassingPercentage: number
}

export interface LearningRule {
  id: string
  naam: string
  /** Verplicht, mens-leesbaar — waarom deze regel bestaat en wat 'm
   * laat vuren. Nooit een regel zonder uitleg, matcht de transparantie-
   * eis uit de Master Vision ("alles reproduceerbaar, alles uitlegbaar"). */
  beschrijving: string
  conditie: (context: LearningContext) => boolean
  effect: LearningRuleEffect
}

/** Exact het voorbeeld uit de Master Vision zelf:
 * if runningSessions > 30 AND recoveryTrend > baseline AND RPE stable
 * then Recovery Factor Running +4% */
export const STANDAARD_REGELS: LearningRule[] = [
  {
    id: 'herstel-beter-dan-verwacht',
    naam: 'Herstelt beter dan verwacht na deze sport',
    beschrijving: 'Bij voldoende sessies (>30), een structureel betere herstel-trend dan de baseline, en een stabiele RPE (betrouwbare data): verhoog de herstelfactor voor deze sport met 4%.',
    conditie: (c) => c.aantalSessies > 30 && c.recoveryTrendVsBaseline > 0 && c.rpeStabiel,
    effect: { pad: 'herstel.herstel_capaciteit', aanpassingPercentage: 4 },
  },
]

export interface RegelResultaat {
  regel: LearningRule
  gevuurd: boolean
}

export interface LearningRulesUitkomst {
  personalisatieStatus: PersonalisatieStatus
  /** Als population_model: leeg, geen enkele regel wordt geëvalueerd —
   * expliciet, niet stilzwijgend */
  resultaten: RegelResultaat[]
}

/** Evalueert alle standaardregels tegen de gegeven context. Draait
 * ALLEEN als de personalisatie-drempel gehaald is — anders wordt dit
 * expliciet in de uitkomst vermeld (`personalisatieStatus`), geen
 * stilzwijgende lege lijst zonder verklaring. */
export function evalueerRegels(context: LearningContext): LearningRulesUitkomst {
  const status = bepaalPersonalisatieStatus(context.sport, context.aantalSessies)

  if (status === 'population_model') {
    return { personalisatieStatus: status, resultaten: [] }
  }

  const resultaten: RegelResultaat[] = STANDAARD_REGELS.map(regel => ({
    regel,
    gevuurd: regel.conditie(context),
  }))

  return { personalisatieStatus: status, resultaten }
}
