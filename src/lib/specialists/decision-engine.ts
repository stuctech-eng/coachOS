// ── Decision Engine ──────────────────────────────────────────────────────
// Bron: docs/specialist-decision-engine.md. VOLLEDIG DETERMINISTISCH —
// geen AI. Wordt pas relevant zodra 2+ specialisten tegelijk actief zijn.
//
// BELANGRIJKE PRECISERING (v2.4.84): regels 1-3 uit het ontwerpdocument
// (gezondheid > prestatie, blessures > periodisering, herstel > belasting)
// zitten al GEDEELTELIJK geborgd via CoachPolicy — elke specialist krijgt
// dezelfde, deterministisch bepaalde grenzen, dus kan al geen te zware
// training adviseren als het herstel laag is.
//
// Het conflict dat regel 3 hieronder oplost, is subtieler: als MEERDERE
// specialisten elk AFZONDERLIJK binnen hun eigen grenzen "meer volume"
// adviseren, ziet geen van beide dat de OPTELSOM alsnog te veel wordt.
//
// v2.4.87 RECHTZETTING op regel 4/5: importance (door de gebruiker
// ingesteld, stabiel) en calculated_urgency (door de Goal Engine
// berekend, dynamisch — gebaseerd op deadline-nabijheid) zijn nu twee
// aparte, niet-vermengde velden. Regel 4 beslist eerst op importance;
// alleen bij een gelijke stand wordt regel 5 (calculated_urgency)
// geraadpleegd als secundaire tiebreaker. Hiervoor was er één "urgency"-
// veld dat de gebruiker zelf invulde — dat liet de gebruiker ten onrechte
// de tijdsdruk-beoordeling bepalen, niet de werkelijkheid (zie
// vervolgoverleg: "FTP 280W" als "critical" markeren terwijl de
// wedstrijd nog 9 maanden weg is, zou de Decision Engine op het verkeerde
// been zetten).

export type SpecialistLoad = 'low' | 'moderate' | 'high'
export type SpecialistRisk = 'none' | 'low' | 'high'

export interface SpecialistSummaryVoorBeslissing {
  specialist: string
  load: SpecialistLoad
  risk: SpecialistRisk
  recommendation: string
  // v2.4.87: TWEE aparte velden, niet vermengd — hoogsteImportance is de
  // gebruikerskeuze (stabiel), hoogsteUrgentie is de Goal Engine-
  // berekening (dynamisch, gebaseerd op deadline-nabijheid). Regel 4
  // gebruikt importance, regel 5 gebruikt calculated_urgency als
  // secundaire tiebreaker binnen gelijke importance.
  hoogsteImportance?: 'must' | 'high' | 'normal' | 'low'
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

  // ── Regel 2: blessures/verhoogd risico gaat altijd vóór ─────────────
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

  // ── Regel 3: bij een herstel- of balansprioriteit mogen niet meerdere
  // sporten tegelijk hun volume opbouwen — dat telt op ──────────────────
  if (coachPriority === 'recovery' || coachPriority === 'balance') {
    const nietLageBelasting = summaries.filter(s => s.load !== 'low')
    if (nietLageBelasting.length >= 2) {
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

  // ── Regel 4 (importance) + Regel 5 (calculated_urgency als tiebreaker) ──
  // Alleen relevant als regel 2/3 geen winnaar aanwezen (belasting/risico
  // zijn vergelijkbaar) — dan beslist eerst de gebruikerskeuze
  // (importance), en pas bij een gelijke stand de berekende urgentie.
  const metDoelData = summaries.filter(s => s.hoogsteImportance || s.hoogsteUrgentie)
  if (metDoelData.length > 0) {
    const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
    const urgentieRang: Record<string, number> = { critical: 3, high: 2, normal: 1, low: 0 }

    const gesorteerd = [...summaries].sort((a, b) => {
      const ia = importanceRang[a.hoogsteImportance || 'normal']
      const ib = importanceRang[b.hoogsteImportance || 'normal']
      if (ia !== ib) return ib - ia
      const ua = urgentieRang[a.hoogsteUrgentie || 'normal']
      const ub = urgentieRang[b.hoogsteUrgentie || 'normal']
      if (ua !== ub) return ub - ua
      const da = a.naasteDeadlineDagen ?? Infinity
      const db = b.naasteDeadlineDagen ?? Infinity
      return da - db
    })
    const winnaar = gesorteerd[0]
    const nummerTwee = gesorteerd[1]

    const daadwerkelijkVerschil = nummerTwee && (
      (winnaar.hoogsteImportance || 'normal') !== (nummerTwee.hoogsteImportance || 'normal') ||
      (winnaar.hoogsteUrgentie || 'normal') !== (nummerTwee.hoogsteUrgentie || 'normal') ||
      (winnaar.naasteDeadlineDagen ?? Infinity) !== (nummerTwee.naasteDeadlineDagen ?? Infinity)
    )

    const winnaarImportance = winnaar.hoogsteImportance || 'normal'
    const winnaarUrgentie = winnaar.hoogsteUrgentie || 'normal'
    const isRelevant = winnaarImportance !== 'low' || winnaarUrgentie !== 'low'

    if (daadwerkelijkVerschil && isRelevant) {
      const welkeRegel = importanceRang[winnaarImportance] !== importanceRang[nummerTwee.hoogsteImportance || 'normal']
        ? 'regel_4_doelbelangrijkheid'
        : 'regel_5_berekende_urgentie_tiebreaker'
      const deadlineTekst = winnaar.naasteDeadlineDagen !== null && winnaar.naasteDeadlineDagen !== undefined
        ? ` (deadline over ${winnaar.naasteDeadlineDagen} dagen)`
        : ''
      return {
        selectedCoach: winnaar.specialist,
        rejectedCoaches: summaries.filter(s => s.specialist !== winnaar.specialist).map(s => s.specialist),
        appliedRule: welkeRegel,
        priorityScore: importanceRang[winnaarImportance] * 10 + urgentieRang[winnaarUrgentie],
        reasoning: [
          `Geen gezondheids- of belastingsconflict — belasting is bij alle specialisten vergelijkbaar.`,
          welkeRegel === 'regel_4_doelbelangrijkheid'
            ? `${winnaar.specialist} Coach heeft een doel dat de gebruiker als "${winnaarImportance}" markeerde — krijgt daarom vandaag de hoofdfocus.`
            : `Doelbelangrijkheid is gelijk — ${winnaar.specialist} Coach heeft de hoogste berekende urgentie vandaag ("${winnaarUrgentie}")${deadlineTekst}, gebaseerd op deadline-nabijheid, niet op wat de gebruiker zelf koos.`,
        ],
      }
    }
  }

  // Geen conflict gevonden — alle specialisten mogen vrij naast elkaar
  // worden meegenomen in het Master Coach-advies
  return null
}
