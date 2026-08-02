import type {
  UniversalWorkout, WorkoutBlock, WorkoutTrainingType, WorkoutMesocycle,
  WorkoutDifficulty, WorkoutExecutionType,
} from './types'
import { haalTrainingszone } from '@/core/knowledge-platform/trainingszones'

// ── CoachOS Workout Platform — Workout Builder ───────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0. Fase 1, stap 2:
// de assemblage-logica zelf. Bewust een KLEINE, concrete input-set om mee
// te beginnen — niet meteen alle 18 inputs uit de visie (Coach Policy/
// Today Plan/Weer/Terrein/etc.) tegelijk aansluiten. Die volgen als latere,
// losse integratiestappen, zodra er een concrete specialist is die ze
// nodig heeft.
//
// KERNREGEL (zelfde als in types.ts): geen sportlogica hier. Targets
// worden generiek gezet (bijv. 'zone', geen FTP-percentage) — de
// Specialist Adapter (later) vertaalt dit naar sportspecifieke waarden.
// Volledig deterministisch — geen AI-aanroep, geen willekeur.

export interface WorkoutBuilderInput {
  sport: string
  trainingType: WorkoutTrainingType
  /** Totale beschikbare tijd in seconden — inclusief warmup/cooldown */
  duration_sec: number
  mesocycle: WorkoutMesocycle
  difficulty: WorkoutDifficulty
  goal?: string
}

function klem(waarde: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, waarde))
}

function nieuwBlokId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `blok-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Aantal intervalherhalingen — hoger in een opbouw/piek-mesocyclus,
 * lager in basis/herstel. Bewust een simpele, vaste regel — geen
 * historische-belasting-afhankelijkheid hier (dat hoort bij een latere
 * Adaptation Engine-stap, niet bij de basisassemblage). */
function bepaalAantalIntervallen(mesocycle: WorkoutMesocycle, difficulty: WorkoutDifficulty): number {
  const basisAantal: Record<WorkoutMesocycle, number> = { basis: 4, opbouw: 5, piek: 6, herstel: 3 }
  const aantal = basisAantal[mesocycle]
  return difficulty === 'beginner' ? Math.max(3, aantal - 1) : difficulty === 'gevorderd' ? aantal + 1 : aantal
}

function bouwWarmup(totaleDuur: number): WorkoutBlock[] {
  const duur = klem(totaleDuur * 0.1, 300, 900) // 10%, tussen 5-15 min
  // v2.4.237-note: bewust GEEN Knowledge Platform-lookup hier — warmup
  // is conceptueel iets anders dan "zone 1 volhouden" (opbouwend,
  // geen sustained effort), ook al is het target-niveau hetzelfde
  return [{
    id: nieuwBlokId(), type: 'warmup', duration_sec: Math.round(duur),
    targets: [{ type: 'zone', zone_nummer: 1 }],
    instruction: 'Rustig opbouwen, geleidelijk naar werktempo.',
  }]
}

function bouwCooldown(totaleDuur: number): WorkoutBlock[] {
  const duur = klem(totaleDuur * 0.05, 180, 600) // 5%, tussen 3-10 min
  return [{
    id: nieuwBlokId(), type: 'cooldown', duration_sec: Math.round(duur),
    targets: [{ type: 'zone', zone_nummer: 1 }],
    instruction: 'Rustig uitlopen, hartslag laten dalen.',
  }]
}

/** Kernlogica: verdeelt de beschikbare hoofdblok-tijd, per trainingType.
 * v2.4.237: instructies komen nu uit de Knowledge Platform
 * (trainingszones.ts) i.p.v. hardcoded tekst — één bron van waarheid,
 * met expliciete sportwetenschappelijke herkomst (%HFmax/RPE) i.p.v.
 * verzonnen zinnen zonder onderbouwing. */
function bouwHoofdblokken(trainingType: WorkoutTrainingType, hoofdblokDuur: number, mesocycle: WorkoutMesocycle, difficulty: WorkoutDifficulty): { blokken: WorkoutBlock[]; executionType: WorkoutExecutionType } {
  if (trainingType === 'interval' || trainingType === 'sprint') {
    const aantal = bepaalAantalIntervallen(mesocycle, difficulty)
    const rustPerHerhaling = trainingType === 'sprint' ? 120 : 90
    const zoneNummer = trainingType === 'sprint' ? 5 : 4
    // Werktijd per herhaling = (totale tijd - alle rustpauzes) / aantal
    const werkPerHerhaling = Math.max(30, Math.round((hoofdblokDuur - rustPerHerhaling * (aantal - 1)) / aantal))
    const blok: WorkoutBlock = {
      id: nieuwBlokId(), type: 'interval', duration_sec: werkPerHerhaling,
      repeat: aantal, rust_na_repeat_sec: rustPerHerhaling,
      targets: [{ type: 'zone', zone_nummer: zoneNummer }],
      instruction: haalTrainingszone(zoneNummer)?.instructie || 'Stevig tempo, gecontroleerd.',
    }
    return { blokken: [blok], executionType: 'FixedTimeInterval' }
  }

  if (trainingType === 'herstel') {
    return {
      blokken: [{
        id: nieuwBlokId(), type: 'hoofdblok', duration_sec: hoofdblokDuur,
        targets: [{ type: 'zone', zone_nummer: 1 }],
        instruction: haalTrainingszone(1)?.instructie || 'Zeer rustig, gesprekstempo.',
      }],
      executionType: 'FixedTime',
    }
  }

  if (trainingType === 'tempo') {
    return {
      blokken: [{
        id: nieuwBlokId(), type: 'hoofdblok', duration_sec: hoofdblokDuur,
        targets: [{ type: 'zone', zone_nummer: 3 }],
        instruction: haalTrainingszone(3)?.instructie || 'Comfortabel-oncomfortabel tempo.',
      }],
      executionType: 'FixedTime',
    }
  }

  // endurance / lange_afstand / test / techniek — één doorlopend blok, zone 2
  return {
    blokken: [{
      id: nieuwBlokId(), type: 'hoofdblok', duration_sec: hoofdblokDuur,
      targets: [{ type: 'zone', zone_nummer: 2 }],
      instruction: trainingType === 'techniek' ? 'Focus op techniek, niet op tempo.' : (haalTrainingszone(2)?.instructie || 'Gelijkmatig, aeroob tempo.'),
    }],
    executionType: 'FixedTime',
  }
}

export function bouwWorkout(input: WorkoutBuilderInput): UniversalWorkout {
  const warmup = bouwWarmup(input.duration_sec)
  const cooldown = bouwCooldown(input.duration_sec)
  let warmupCooldownDuur = warmup[0].duration_sec + cooldown[0].duration_sec

  // v2.4.225-FIX: bij een extreem korte sessie (bijv. 5 min) konden de
  // vaste MIN-grenzen van warmup (min 300s) + cooldown (min 180s) samen
  // de totale gevraagde duur overschrijden — het hoofdblok werd dan
  // geforceerd op een minimum van 60s, waardoor de WERKELIJKE totale
  // duur de gevraagde duration_sec overschreed (bijv. 540s i.p.v. de
  // gevraagde 300s). Nu: als warmup+cooldown samen meer dan 50% van de
  // totale duur zouden innemen, worden ze evenredig verkleind.
  const maxWarmupCooldown = input.duration_sec * 0.5
  if (warmupCooldownDuur > maxWarmupCooldown) {
    const schaal = maxWarmupCooldown / warmupCooldownDuur
    warmup[0].duration_sec = Math.max(60, Math.round(warmup[0].duration_sec * schaal))
    cooldown[0].duration_sec = Math.max(30, Math.round(cooldown[0].duration_sec * schaal))
    warmupCooldownDuur = warmup[0].duration_sec + cooldown[0].duration_sec
  }

  const hoofdblokDuur = Math.max(60, input.duration_sec - warmupCooldownDuur)

  const { blokken: mainBlocks, executionType } = bouwHoofdblokken(input.trainingType, hoofdblokDuur, input.mesocycle, input.difficulty)

  return {
    id: nieuwBlokId(),
    sport: input.sport,
    goal: input.goal || input.trainingType,
    difficulty: input.difficulty,
    mesocycle: input.mesocycle,
    trainingType: input.trainingType,
    executionType,
    duration_sec: input.duration_sec,
    warmup,
    mainBlocks,
    recoveryBlocks: [],
    cooldown,
    targets: [],
    coachNotes: '',
    executionHints: [],
    equipment: { benodigd: [] },
    metrics: {},
    adaptations: [],
  }
}
