// ── Context Resolver ──────────────────────────────────────────────────
// Bron: overleg 22 juli 2026, Coach Context Engine Fase 1. VOLLEDIG
// PUUR — geen database, geen API-calls, geen AI. Neemt ruwe input,
// levert één opgeloste werkelijkheid. Daardoor herbruikbaar door Coach-
// prompt, Training Engine, Performance Score, Today Engine en elke
// toekomstige specialist, zonder dat ze elk hun eigen interpretatie
// van dezelfde ruwe events hoeven te bouwen.
//
// Kernprincipe: events verdwijnen nooit stilzwijgend. Een onderdrukt
// event krijgt een zichtbare status + reden — belangrijk voor
// debugging, gebruikersvertrouwen, en latere agenda-integratie ("Waarom
// staat mijn werk niet in mijn planning?").

// ── Prioriteitsvolgorde — expliciete configuratie, niet verstopt in
// logica. Wijzig hier als de volgorde ooit moet veranderen (bijv.
// "Wedstrijd boven Vakantie" of een nieuwe categorie "Trainingskamp"),
// niet door de resolver-functie zelf aan te passen.
export const CONTEXT_PRIORITY = [
  'blessure', 'ziekte', 'vakantie', 'herstel', 'wedstrijd', 'werk', 'training', 'vrije_tijd',
] as const

export type ContextCategory = typeof CONTEXT_PRIORITY[number]
export type ContextMode = ContextCategory | 'normaal'

// Koppelt de bestaande life_events.type-waarden (zie EVENT_CATEGORIES in
// life-events/page.tsx) aan een prioriteitscategorie. Nieuwe event-
// typen die hier niet in staan, vallen terug op 'vrije_tijd' (laagste
// prioriteit, kan nooit per ongeluk iets belangrijks overschrijven).
const EVENT_TYPE_NAAR_CATEGORIE: Record<string, ContextCategory> = {
  // werk
  nachtdienst: 'werk', avonddienst: 'werk', vroege_dienst: 'werk', dagdienst: 'werk',
  thuiswerken: 'werk', lange_dag: 'werk', werk_stress: 'werk',
  // leven
  vakantie: 'vakantie', reizen: 'vrije_tijd', feest: 'vrije_tijd', sociaal: 'vrije_tijd', jetlag: 'herstel',
  // gezondheid
  ziek: 'ziekte', emotionele_stress: 'herstel', slecht_geslapen: 'herstel', hersteldag: 'herstel',
  // vrije tijd / omgeving
  vrije_dag: 'vrije_tijd', extreme_hitte: 'vrije_tijd',
}

export interface LifeEventInput {
  type: string
  start_hour: number | null
  end_hour: number | null
  notes: string | null
  recovery_impact?: number | null
  stress_load?: number | null
  sleep_disruption?: number | null
}

export interface InjuryInput {
  body_part: string
  pain_score: number
}

export interface SuppressedEvent {
  type: string
  status: 'suppressed'
  reason: string
}

export interface LifeContext {
  mode: ContextMode
  priorityReason: string
  coachInstruction: string
  suppressedEvents: SuppressedEvent[]
}

export interface HealthContext {
  activeInjuries: boolean
  injuryDetails: InjuryInput[]
}

export interface TrainingImpact {
  trainingModifier: number // percentage, bijv. -30 = 30% minder trainingsbelasting
  recoveryModifier: number // percentage, bijv. +20 = 20% gunstiger voor herstel
  stressModifier: number // percentage, bijv. -40 = 40% minder fysiologische stress-aanname
}

// v2.4.173: herstructureerd op verzoek — "Life Events = leven, Injuries
// = gezondheid, Goals = prestaties, Training = uitvoering. De Context
// Resolver brengt ze samen, maar de bronnen blijven gescheiden." Puur
// een output-herindeling — de beslislogica hieronder is ongewijzigd.
export interface ResolvedContext {
  lifeContext: LifeContext
  healthContext: HealthContext
  trainingImpact: TrainingImpact
  // Blijft top-level (geen nesting) — wordt rechtstreeks als getal
  // doorgegeven aan calculateRecoveryScore(), geen reden om dat een
  // extra laag diep te maken
  lifeEventPenalty: number
}

// Vaste, eerlijk-benoemde modifiers per categorie — v1, ronde getallen,
// geen exacte wetenschappelijke claim. "Vakantie" komt letterlijk uit
// het overleg (-30/+20/-40). De rest is naar analogie ingeschat en kan
// later verfijnd worden zodra er ervaring mee is.
const MODIFIERS: Record<ContextCategory, { training: number; recovery: number; stress: number; instructie: string }> = {
  blessure: { training: -100, recovery: 0, stress: 0, instructie: 'Focus op herstel van de blessure — geen training in dit gebied.' },
  ziekte: { training: -100, recovery: -20, stress: 0, instructie: 'Volledig herstel staat voorop — geen training tot je beter bent.' },
  vakantie: { training: -30, recovery: 20, stress: -40, instructie: 'Focus op onderhoud en plezier.' },
  herstel: { training: -50, recovery: 10, stress: -10, instructie: 'Vandaag ligt de nadruk op herstel, niet op belasting.' },
  wedstrijd: { training: 0, recovery: 0, stress: 0, instructie: 'Wedstrijddag — focus op uitvoering, niet op nieuwe belasting.' },
  werk: { training: -10, recovery: 0, stress: 10, instructie: 'Houd rekening met je werkdag bij de planning van vandaag.' },
  training: { training: 0, recovery: 0, stress: 0, instructie: '' },
  vrije_tijd: { training: 0, recovery: 0, stress: 0, instructie: '' },
}

function categorieVan(type: string): ContextCategory {
  return EVENT_TYPE_NAAR_CATEGORIE[type] || 'vrije_tijd'
}

export interface DagContextInput {
  lifeEvents: LifeEventInput[]
  injuries?: InjuryInput[]
  // v2.4.175 (Coach Agenda Fase 2, eerste stap): Nederlandse feestdagen
  // — was tot nu toe alleen visuele decoratie in de kalender-UI, de
  // Coach wist er niets van. Puur informatief, laagste prioriteit
  // (vrije_tijd) — overschrijft nooit iets belangrijkers zoals werk of
  // vakantie, maar wordt wél zichtbaar als er verder niets speelt.
  holiday?: { name: string } | null
}

export function bepaalDagContext(input: DagContextInput): ResolvedContext {
  const { lifeEvents, injuries = [], holiday = null } = input

  // Zelfde formule als voorheen los in api/status/route.ts —
  // ongewijzigd, nu op één plek
  const lifeEventPenalty = lifeEvents.reduce(
    (acc, e) => acc + (e.recovery_impact || 0) * 5 + (e.sleep_disruption || 0) * 3,
    0
  )

  const healthContext: HealthContext = { activeInjuries: injuries.length > 0, injuryDetails: injuries }

  // Geen events, geen blessures, geen feestdag — nette, neutrale
  // standaardstaat
  if (lifeEvents.length === 0 && injuries.length === 0 && !holiday) {
    return {
      lifeContext: { mode: 'normaal', priorityReason: 'Geen bijzondere levensgebeurtenissen vandaag', coachInstruction: '', suppressedEvents: [] },
      healthContext,
      trainingImpact: { trainingModifier: 0, recoveryModifier: 0, stressModifier: 0 },
      lifeEventPenalty: 0,
    }
  }

  // Bepaal de hoogste-prioriteit-categorie die vandaag daadwerkelijk
  // aanwezig is
  const aanwezigeCategorieen = new Set<ContextCategory>()
  if (injuries.length > 0) aanwezigeCategorieen.add('blessure')
  if (holiday) aanwezigeCategorieen.add('vrije_tijd')
  for (const e of lifeEvents) aanwezigeCategorieen.add(categorieVan(e.type))

  const winnendeCategorie = CONTEXT_PRIORITY.find(c => aanwezigeCategorieen.has(c)) || 'vrije_tijd'

  // Events met een LAGERE prioriteit dan de winnende categorie worden
  // onderdrukt — nooit verwijderd, altijd zichtbaar met reden
  const winnendeRang = CONTEXT_PRIORITY.indexOf(winnendeCategorie)
  const suppressedEvents: SuppressedEvent[] = lifeEvents
    .filter(e => CONTEXT_PRIORITY.indexOf(categorieVan(e.type)) > winnendeRang)
    .map(e => ({ type: e.type, status: 'suppressed', reason: `overschreven door ${winnendeCategorie}` }))

  const modifier = MODIFIERS[winnendeCategorie]
  // v2.4.315-FIX: gemeld — het Dagplan wist wel DAT er een werkdag was
  // (winnendeCategorie werd correct 'werk'), maar de instructietekst
  // was een statische, generieke zin zonder de daadwerkelijke tijden.
  // De AI kon dus niet om het concrete tijdvak heen plannen — precies
  // hetzelfde bug-patroon als de "35 vs. 50 minuten"-bevinding (Regel
  // 0c): een instructie zonder gestructureerde, concrete waarden.
  // Fix: als er een 'werk'-event met start_hour/end_hour bestaat, die
  // tijden expliciet in de instructie opnemen.
  const winnendWerkEvent = winnendeCategorie === 'werk'
    ? lifeEvents.find(e => categorieVan(e.type) === 'werk' && e.start_hour !== null && e.end_hour !== null)
    : null
  const werkTijdenTekst = winnendWerkEvent
    ? ` (${String(winnendWerkEvent.start_hour).padStart(2, '0')}:00-${String(winnendWerkEvent.end_hour).padStart(2, '0')}:00) — plan geen training in dit tijdvak`
    : ''
  // Feestdag wint (of is de enige reden dat vrije_tijd de winnende
  // categorie is) — noem 'm expliciet bij naam, niet alleen "vrije_tijd"
  const feestdagIsRedenVanVrijeTijd = winnendeCategorie === 'vrije_tijd' && holiday
  const priorityReason = winnendeCategorie === 'blessure'
    ? `Actieve blessure (${injuries.map(i => i.body_part).join(', ')}) heeft voorrang op alles`
    : feestdagIsRedenVanVrijeTijd
      ? `Vandaag is het ${holiday!.name}`
      : suppressedEvents.length > 0
        ? `${winnendeCategorie} overschrijft ${[...new Set(suppressedEvents.map(e => e.type))].join(', ')}`
        : `${winnendeCategorie} is vandaag van toepassing`
  const coachInstruction = feestdagIsRedenVanVrijeTijd
    ? `Vandaag is het ${holiday!.name} — een vrije dag, mogelijk extra ruimte om te trainen.`
    : modifier.instructie + werkTijdenTekst

  return {
    lifeContext: { mode: winnendeCategorie, priorityReason, coachInstruction, suppressedEvents },
    healthContext,
    trainingImpact: { trainingModifier: modifier.training, recoveryModifier: modifier.recovery, stressModifier: modifier.stress },
    lifeEventPenalty,
  }
}
