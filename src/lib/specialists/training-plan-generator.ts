import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'
import { genereerCoachPolicy } from './coach-policy'
import { haalGoalsMetProgress } from './goal-engine'
import { analyseerCycling } from './cycling-analysis'

// ── Plan Generator — Adaptive Training Plan Engine, Fase 1 ─────────────
// Bron: docs/adaptive-training-plan-engine-spec.md +
// docs/adaptive-training-plan-decision-contract-v1.md. VOLLEDIG
// DETERMINISTISCH — geen AI-aanroep.
//
// Periodiseringsmodel en dag-sessietype-verdeling zijn bewust EENVOUDIGE,
// gedocumenteerde v1-regels — beide documenten laten expliciet vast
// staan dat exacte drempelwaarden/algoritmes "vergen praktijkervaring,
// niet een documentbeslissing". Dit is dus een redelijk startpunt, geen
// definitieve sportwetenschappelijke claim.

export type MesocycleType = 'basis' | 'opbouw' | 'piek' | 'herstel'
const ROLLING_HORIZON_WEKEN = 2 // komende 2 weken: volledige dagplanning
const STANDAARD_MACROCYCLUS_WEKEN = 12 // als er geen streefdatum is

interface CyclingProfileData {
  ftp?: number
  max_hartslag?: number
  trainingsdagen?: string[]
  beschikbare_uren_per_week?: number
}

interface MesocycleWeek {
  week_nummer: number // 0-indexed vanaf plan-start
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

// ── Mesocyclus-planning ───────────────────────────────────────────────
function bepaalMesocycli(weekTotaal: number, beschikbareUren: number): MesocycleWeek[] {
  const weken: MesocycleWeek[] = []

  if (weekTotaal < 4) {
    // Te kort voor volledige periodisering — gewoon basis-onderhoud
    for (let i = 0; i < weekTotaal; i++) {
      weken.push({ week_nummer: i, type: 'basis', week_load_uren: Math.round(beschikbareUren * 0.7 * 10) / 10 })
    }
    return weken
  }

  // Met voldoende weken: basis (40%) → opbouw (35%) → piek (15%) → herstel/taper (10%, min. 1 week)
  const basisWeken = Math.max(1, Math.round(weekTotaal * 0.4))
  const opbouwWeken = Math.max(1, Math.round(weekTotaal * 0.35))
  const piekWeken = Math.max(1, Math.round(weekTotaal * 0.15))
  const taperWeken = Math.max(1, weekTotaal - basisWeken - opbouwWeken - piekWeken)

  let week = 0
  for (let i = 0; i < basisWeken; i++, week++) weken.push({ week_nummer: week, type: 'basis', week_load_uren: Math.round(beschikbareUren * 0.7 * 10) / 10 })
  for (let i = 0; i < opbouwWeken; i++, week++) {
    // Klassiek 3:1-patroon binnen opbouw: elke 4e week een hersteldip
    const isHerstelweek = (i + 1) % 4 === 0
    weken.push({ week_nummer: week, type: isHerstelweek ? 'herstel' : 'opbouw', week_load_uren: Math.round(beschikbareUren * (isHerstelweek ? 0.5 : 0.95) * 10) / 10 })
  }
  for (let i = 0; i < piekWeken; i++, week++) weken.push({ week_nummer: week, type: 'piek', week_load_uren: Math.round(beschikbareUren * 0.85 * 10) / 10 })
  for (let i = 0; i < taperWeken; i++, week++) weken.push({ week_nummer: week, type: 'herstel', week_load_uren: Math.round(beschikbareUren * 0.5 * 10) / 10 })

  return weken.slice(0, weekTotaal)
}

// ── Dag-sessietype-verdeling, per mesocyclus-type ───────────────────────
function verdeelSessieTypen(trainingsdagen: string[], mesocycleType: MesocycleType): Array<{ dag: string; type: string }> {
  const aantal = trainingsdagen.length
  if (aantal === 0) return []

  // Basisverdeling — eenvoudige, gedocumenteerde v1-regel
  const typesBijAantal: Record<number, string[]> = {
    1: ['duurtraining'],
    2: ['duurtraining', 'duurtraining'],
    3: ['duurtraining', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'lange_duurtraining'],
    4: ['duurtraining', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'herstel', 'lange_duurtraining'],
    5: ['duurtraining', mesocycleType === 'herstel' ? 'herstel' : 'interval', 'herstel', 'duurtraining', 'lange_duurtraining'],
  }
  const types = typesBijAantal[Math.min(aantal, 5)] || typesBijAantal[5]

  // Bij 'herstel'-mesocyclus: geen enkele interval-sessie, ongeacht het aantal dagen
  const finaleTypes = mesocycleType === 'herstel'
    ? types.map(t => t === 'interval' ? 'duurtraining' : t)
    : types

  return trainingsdagen.slice(0, aantal).map((dag, i) => ({ dag, type: finaleTypes[i] || 'duurtraining' }))
}

const DAG_VOLGORDE = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

function volgendeDatumVoorDag(vanaf: Date, dagNaam: string, weekOffset: number): Date {
  const dagIndex = DAG_VOLGORDE.indexOf(dagNaam)
  const resultaat = new Date(vanaf)
  resultaat.setDate(resultaat.getDate() + weekOffset * 7)
  const huidigeDagIndex = (resultaat.getDay() + 6) % 7 // maandag=0
  const verschil = (dagIndex - huidigeDagIndex + 7) % 7
  resultaat.setDate(resultaat.getDate() + verschil)
  return resultaat
}

export async function genereerTrainingsplan(userId: string): Promise<GegenereerdePlanResultaat> {
  const supabase = createAdminClient()
  const reden: string[] = []

  // ── Input verzamelen — alles bestaat al, geen nieuwe databron ────────
  const [profielRes, policy, goalProgress, analyse] = await Promise.all([
    supabase.from('specialist_profiles').select('preferences').eq('user_id', userId).eq('specialist_type', 'cycling').maybeSingle(),
    genereerCoachPolicy(userId),
    haalGoalsMetProgress(userId, 'cycling'),
    analyseerCycling(userId, 90),
  ])

  const profiel: CyclingProfileData = profielRes.data?.preferences || {}
  const trainingsdagen = profiel.trainingsdagen || []
  const beschikbareUren = profiel.beschikbare_uren_per_week || 4 // veilige default als niet ingevuld

  if (trainingsdagen.length === 0) {
    throw new Error('Geen trainingsdagen ingesteld in het Cycling Profile — vul dit eerst in via Instellingen > Cycling Profile')
  }

  // Leidend doel: specialist-scoped Cycling-doel met de hoogste importance
  const specialistDoelen = goalProgress.filter(g => g.goal_scope === 'specialist')
  const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
  const leidendDoel = specialistDoelen.length > 0
    ? specialistDoelen.reduce((a, b) => importanceRang[a.importance] >= importanceRang[b.importance] ? a : b)
    : null

  const vandaag = new Date()
  const startDate = new Date(vandaag)

  let weekTotaal: number
  let endDate: Date
  if (leidendDoel?.dagen_resterend && leidendDoel.dagen_resterend > 0) {
    weekTotaal = Math.max(1, Math.ceil(leidendDoel.dagen_resterend / 7))
    endDate = new Date(vandaag)
    endDate.setDate(endDate.getDate() + leidendDoel.dagen_resterend)
    reden.push(`Macrocyclus gebaseerd op leidend doel "${leidendDoel.title}", ${weekTotaal} weken tot streefdatum.`)
  } else {
    weekTotaal = STANDAARD_MACROCYCLUS_WEKEN
    endDate = new Date(vandaag)
    endDate.setDate(endDate.getDate() + weekTotaal * 7)
    reden.push(`Geen streefdatum bij een leidend doel gevonden — standaard ${STANDAARD_MACROCYCLUS_WEKEN}-weken-macrocyclus.`)
  }

  const mesocycli = bepaalMesocycli(weekTotaal, beschikbareUren)

  // ── Analysis Engine-data daadwerkelijk gebruikt: als de huidige
  // trainingsbelasting (laatste 90 dagen) fors lager ligt dan het
  // beschikbare-uren-doel, wordt de EERSTE basisweek verzacht i.p.v.
  // meteen op het volle streefvolume te starten — voorkomt een te
  // agressieve sprong in week 1.
  const huidigeGemUrenPerWeek = analyse.resultaat.trainingsbelasting.totale_minuten / 90 * 7 / 60
  if (mesocycli.length > 0 && huidigeGemUrenPerWeek < beschikbareUren * 0.5) {
    const oorspronkelijk = mesocycli[0].week_load_uren
    mesocycli[0].week_load_uren = Math.round(Math.max(huidigeGemUrenPerWeek * 1.1, oorspronkelijk * 0.6) * 10) / 10
    reden.push(`Eerste basisweek verzacht (${oorspronkelijk}u → ${mesocycli[0].week_load_uren}u) — huidige trainingsbelasting (~${Math.round(huidigeGemUrenPerWeek * 10) / 10}u/week) ligt fors onder het streefvolume, te snelle opbouw vergroot blessurerisico.`)
  }

  reden.push(`${mesocycli.length} weken verdeeld over mesocycli: ${[...new Set(mesocycli.map(m => m.type))].join(', ')}.`)

  // ── Plan opslaan ───────────────────────────────────────────────────
  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      athlete_id: userId,
      goal_id: leidendDoel?.goal_id || null,
      start_date: isoDatum(startDate),
      end_date: isoDatum(endDate),
      status: 'active',
      created_by: 'generator',
    })
    .select()
    .single()

  if (planError) throw planError

  // ── Sessies aanmaken — ROLLING HORIZON: alleen komende
  // ROLLING_HORIZON_WEKEN volledig, daarna alleen mesocyclus-targets
  // (geen sessie-rijen voor die verder-weg-weken — die volgen zodra de
  // week dichterbij komt, exact zoals in de hoofdspec vastgelegd) ─────
  let aantalSessies = 0
  const teGenererenWeken = Math.min(ROLLING_HORIZON_WEKEN, mesocycli.length)

  for (let weekOffset = 0; weekOffset < teGenererenWeken; weekOffset++) {
    const mesocyclusWeek = mesocycli[weekOffset]
    const sessieTypen = verdeelSessieTypen(trainingsdagen, mesocyclusWeek.type)

    for (const { dag, type } of sessieTypen) {
      const datum = volgendeDatumVoorDag(startDate, dag, weekOffset)
      const duurMinuten = Math.round((mesocyclusWeek.week_load_uren * 60) / sessieTypen.length)

      // ── Prioriteitsketen afdwingen: CoachPolicy > Specialist > Generator.
      // Elke voorgestelde sessie wordt VÓÓR opslag getoetst — dit is de
      // "harde constraint"-validatie uit het Decision Contract, sectie 1.
      let finaalType = type
      let finaleDuur = duurMinuten
      if (type === 'interval' && policy.forbiddenTrainingTypes.includes('hoge_intensiteit')) {
        finaalType = 'duurtraining' // automatisch teruggebracht binnen de grens, geen AI-gok
        reden.push(`Interval op ${dag} (week ${weekOffset + 1}) teruggebracht naar duurtraining — CoachPolicy verbiedt hoge intensiteit.`)
      }
      if (policy.volumeAdjustmentPct < 0) {
        finaleDuur = Math.round(duurMinuten * (1 + policy.volumeAdjustmentPct / 100))
      }

      const { error: sessieError } = await supabase
        .from('training_plan_sessions')
        .insert({
          plan_id: plan.id,
          date: isoDatum(datum),
          sport: 'cycling',
          type: finaalType,
          duration: finaleDuur,
          intensity: null, // watt-range volgt in een latere sub-stap, samen met de Coach-uitleglaag
          load_target: mesocyclusWeek.week_load_uren / sessieTypen.length,
          status: weekOffset === 0 ? 'scheduled' : 'planned',
        })

      if (!sessieError) aantalSessies++
    }
  }

  reden.push(`${aantalSessies} concrete sessies aangemaakt voor de komende ${teGenererenWeken} weken (rolling horizon) — verder weg alleen weekbelasting-targets, nog geen dagplanning.`)

  return {
    plan_id: plan.id,
    start_date: plan.start_date,
    end_date: plan.end_date,
    mesocycli,
    aantal_sessies_aangemaakt: aantalSessies,
    reden,
  }
}
