// ── Decision Engine ──────────────────────────────────────────────────────
// Bron: docs/specialist-decision-engine.md. VOLLEDIG DETERMINISTISCH —
// geen AI. Wordt pas relevant zodra 2+ specialisten tegelijk actief zijn.
//
// BELANGRIJKE PRECISERING (v2.4.84): regels 1-3 uit het ontwerpdocument
// (gezondheid > prestatie, blessures > periodisering, herstel > belasting)
// zitten al GEDEELTELIJK geborgd via CoachPolicy — elke specialist krijgt
// dezelfde, deterministisch bepaalde grenzen (max intensiteit, verboden
// trainingstypes), dus geen enkele specialist kan al een te zware
// training adviseren als het herstel laag is.
//
// Het conflict dat déze Decision Engine oplost, is subtieler: als
// MEERDERE specialisten elk AFZONDERLIJK binnen hun eigen grenzen "meer
// volume" adviseren, ziet geen van beide dat de OPTELSOM van hun advies
// alsnog te veel wordt voor het totale hersteltraject. Dat overzicht
// heeft alleen de Decision Engine (en uiteindelijk de Master Coach).

export type SpecialistLoad = 'low' | 'moderate' | 'high'
export type SpecialistRisk = 'none' | 'low' | 'high'

export interface SpecialistSummaryVoorBeslissing {
  specialist: string
  load: SpecialistLoad
  risk: SpecialistRisk
  recommendation: string
  // v2.4.86: optioneel — hoogste urgentie/naaste deadline onder de
  // specialist-specifieke doelen van deze specialist (Goal Engine).
  // Alleen gebruikt door regel 4/5 hieronder, als tiebreaker.
  hoogsteUrgentie?: 'critical' | 'high' | 'normal' | 'low'
  naasteDeadlineDagen?: number | null
}

export interface DecisionResult {
  selectedCoach: string
  rejectedCoaches: string[]
  appliedRule: string
  priorityScore: number
  reasoning: string[]
}

/**
 * Beslist tussen meerdere SpecialistSummary's welke vandaag de hoofdfocus
 * krijgt. Retourneert null als er geen conflict is (0-1 specialist actief,
 * of geen van de regels hieronder van toepassing) — in dat geval blijven
 * alle specialisten gewoon naast elkaar bestaan in het Master Coach-advies.
 */
export function beslisTussenSpecialisten(
  summaries: SpecialistSummaryVoorBeslissing[],
  coachPriority: 'recovery' | 'performance' | 'balance'
): DecisionResult | null {
  // Geen conflict mogelijk met 0 of 1 actieve specialist
  if (summaries.length < 2) return null

  // ── Regel 2: blessures/verhoogd risico gaat altijd vóór, ongeacht wat
  // andere specialisten adviseren (specialist-decision-engine.md regel 2:
  // "blessures gaan vóór periodisering") ──────────────────────────────
  const hoogRisico = summaries.find(s => s.risk === 'high')
  if (hoogRisico) {
    return {
      selectedCoach: hoogRisico.specialist,
      rejectedCoaches: summaries.filter(s => s.specialist !== hoogRisico.specialist).map(s => s.specialist),
      appliedRule: 'regel_2_blessures_voor_periodisering',
      priorityScore: 100,
      reasoning: [
        `${hoogRisico.specialist} Coach signaleert verhoogd risico — krijgt vandaag voorrang.`,
        `Overige specialisten worden vandaag getemperd totdat dit risico is afgenomen.`,
      ],
    }
  }

  // ── Regel 3: bij een herstel- of balansprioriteit (dus NIET
  // 'performance', wat betekent dat het herstel al goed is) mogen niet
  // meerdere sporten tegelijk hun volume opbouwen — dat telt op ──────
  if (coachPriority === 'recovery' || coachPriority === 'balance') {
    const nietLageBelasting = summaries.filter(s => s.load !== 'low')
    if (nietLageBelasting.length >= 2) {
      // Hoogste belasting krijgt de hoofdfocus (die specialist "wint"
      // het gesprek van vandaag), de rest wordt getemperd
      const hoofdfocus = nietLageBelasting.reduce((a, b) => {
        const rang = { low: 0, moderate: 1, high: 2 }
        return rang[a.load] >= rang[b.load] ? a : b
      })
      return {
        selectedCoach: hoofdfocus.specialist,
        rejectedCoaches: summaries.filter(s => s.specialist !== hoofdfocus.specialist).map(s => s.specialist),
        appliedRule: 'regel_3_herstel_voor_belasting',
        priorityScore: 70,
        reasoning: [
          `Coach-prioriteit is momenteel "${coachPriority}" — niet geschikt om meerdere sporten tegelijk op te bouwen.`,
          `${hoofdfocus.specialist} Coach heeft de hoogste belasting van de actieve specialisten, krijgt vandaag de hoofdfocus.`,
          `Overige specialisten: volume vandaag bewust niet verder opbouwen, wel gewoon actief blijven op laag niveau.`,
        ],
      }
    }
  }

  // Geen conflict gevonden via regel 2/3 — check regel 4/5 als tiebreaker
  // ── Regel 4/5: lange termijn > korte termijn, gebruikersdoel als
  // tiebreaker (specialist-decision-engine.md). Alleen relevant als de
  // specialisten qua belasting/risico gelijkwaardig zijn (anders had
  // regel 2/3 al een winnaar aangewezen) — dan beslist welke specialist
  // de meest urgente/naderende deadline-doelen heeft. Vergt Goal Engine-
  // data (urgency), pas mogelijk sinds v2.4.86. ─────────────────────────
  const metUrgentie = summaries.filter(s => s.hoogsteUrgentie)
  if (metUrgentie.length > 0) {
    const urgentieRang: Record<string, number> = { critical: 3, high: 2, normal: 1, low: 0 }
    const gesorteerd = [...summaries].sort((a, b) => {
      const ua = urgentieRang[a.hoogsteUrgentie || 'normal']
      const ub = urgentieRang[b.hoogsteUrgentie || 'normal']
      if (ua !== ub) return ub - ua
      const da = a.naasteDeadlineDagen ?? Infinity
      const db = b.naasteDeadlineDagen ?? Infinity
      return da - db
    })
    const winnaar = gesorteerd[0]
    const nummerTwee = gesorteerd[1]

    // Alleen een DecisionResult teruggeven als er daadwerkelijk een
    // aanwijsbaar verschil is — anders blijft iedereen gelijkwaardig
    const daadwerkelijkVerschil = nummerTwee && (
      (winnaar.hoogsteUrgentie || 'normal') !== (nummerTwee.hoogsteUrgentie || 'normal') ||
      (winnaar.naasteDeadlineDagen ?? Infinity) !== (nummerTwee.naasteDeadlineDagen ?? Infinity)
    )

    if (daadwerkelijkVerschil && winnaar.hoogsteUrgentie && winnaar.hoogsteUrgentie !== 'low') {
      const deadlineTekst = winnaar.naasteDeadlineDagen !== null && winnaar.naasteDeadlineDagen !== undefined
        ? ` (deadline over ${winnaar.naasteDeadlineDagen} dagen)`
        : ''
      return {
        selectedCoach: winnaar.specialist,
        rejectedCoaches: summaries.filter(s => s.specialist !== winnaar.specialist).map(s => s.specialist),
        appliedRule: 'regel_4_5_doelurgentie_tiebreaker',
        priorityScore: urgentieRang[winnaar.hoogsteUrgentie] * 10,
        reasoning: [
          `Geen gezondheids- of belastingsconflict — belasting is bij alle specialisten vergelijkbaar.`,
          `${winnaar.specialist} Coach heeft een doel met urgentie "${winnaar.hoogsteUrgentie}"${deadlineTekst} — krijgt daarom vandaag de hoofdfocus.`,
        ],
      }
    }
  }

  // Geen conflict gevonden — alle specialisten mogen vrij naast elkaar
  // worden meegenomen in het Master Coach-advies
  return null
}
