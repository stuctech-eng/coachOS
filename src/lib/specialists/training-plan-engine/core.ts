import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'
import { genereerCoachPolicy } from '../coach-policy'
import { haalGoalsMetProgress } from '../goal-engine'
import type { MesocycleWeek, GegenereerdePlanResultaat, TrainingPlanSportAdapter } from './types'

// ── Plan Generator Core — platformcomponent ─────────────────────────────
// Bron: docs/adaptive-training-plan-engine-spec.md +
// docs/adaptive-training-plan-decision-contract-v1.md (oorspronkelijk
// voor Cycling geschreven, hier sport-onafhankelijk gemaakt — de
// wiskunde zelf was al 100% generiek, alleen de sport-specifieke
// aanroepen zaten hardcoded). VOLLEDIG DETERMINISTISCH — geen AI.
//
// Periodiseringsmodel en dag-sessietype-verdeling zijn bewust EENVOUDIGE,
// gedocumenteerde v1-regels — "vergen praktijkervaring, niet een
// documentbeslissing". Geen definitieve sportwetenschappelijke claim.

const ROLLING_HORIZON_WEKEN = 2
const STANDAARD_MACROCYCLUS_WEKEN = 12

// ── Mesocyclus-planning — 100% generiek, geen sport-concept nodig ───────
export function bepaalMesocycli(weekTotaal: number, beschikbareUren: number): MesocycleWeek[] {
  const weken: MesocycleWeek[] = []

  if (weekTotaal < 4) {
    for (let i = 0; i < weekTotaal; i++) {
      weken.push({ week_nummer: i, type: 'basis', week_load_uren: Math.round(beschikbareUren * 0.7 * 10) / 10 })
    }
    return weken
  }

  const basisWeken = Math.max(1, Math.round(weekTotaal * 0.4))
  const opbouwWeken = Math.max(1, Math.round(weekTotaal * 0.35))
  const piekWeken = Math.max(1, Math.round(weekTotaal * 0.15))
  const taperWeken = Math.max(1, weekTotaal - basisWeken - opbouwWeken - piekWeken)

  let week = 0
  for (let i = 0; i < basisWeken; i++, week++) weken.push({ week_nummer: week, type: 'basis', week_load_uren: Math.round(beschikbareUren * 0.7 * 10) / 10 })
  for (let i = 0; i < opbouwWeken; i++, week++) {
    const isHerstelweek = (i + 1) % 4 === 0
    weken.push({ week_nummer: week, type: isHerstelweek ? 'herstel' : 'opbouw', week_load_uren: Math.round(beschikbareUren * (isHerstelweek ? 0.5 : 0.95) * 10) / 10 })
  }
  for (let i = 0; i < piekWeken; i++, week++) weken.push({ week_nummer: week, type: 'piek', week_load_uren: Math.round(beschikbareUren * 0.85 * 10) / 10 })
  for (let i = 0; i < taperWeken; i++, week++) weken.push({ week_nummer: week, type: 'herstel', week_load_uren: Math.round(beschikbareUren * 0.5 * 10) / 10 })

  return weken.slice(0, weekTotaal)
}

const DAG_VOLGORDE = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

export function volgendeDatumVoorDag(vanaf: Date, dagNaam: string, weekOffset: number): Date {
  const dagIndex = DAG_VOLGORDE.indexOf(dagNaam)
  const resultaat = new Date(vanaf)
  resultaat.setDate(resultaat.getDate() + weekOffset * 7)
  const huidigeDagIndex = (resultaat.getDay() + 6) % 7
  const verschil = (dagIndex - huidigeDagIndex + 7) % 7
  resultaat.setDate(resultaat.getDate() + verschil)
  return resultaat
}

export async function genereerTrainingsplanCore(userId: string, adapter: TrainingPlanSportAdapter): Promise<GegenereerdePlanResultaat> {
  const supabase = createAdminClient()
  const reden: string[] = []

  const [profiel, policy, goalProgress, huidigeGemUrenPerWeek] = await Promise.all([
    adapter.haalProfiel(userId),
    genereerCoachPolicy(userId),
    haalGoalsMetProgress(userId, adapter.specialistType),
    adapter.haalHuidigeWekelijkseUren(userId),
  ])

  const trainingsdagen = profiel.trainingsdagen || []
  const beschikbareUren = profiel.beschikbare_uren_per_week || 4

  if (trainingsdagen.length === 0) {
    // v2.4.223-FIX: was een hardcoded cycling/running-ternary — bij een
    // derde sport (rowing) zou dit altijd "Running Profile" tonen, ook
    // voor een Rowing-gebruiker. De Core-documentatie zegt zelf "geen
    // enkele sportnaam-check hoort in de Core" — dit was daar een
    // uitzondering op. Nu echt generiek: eerste letter hoofdletter.
    const sportLabel = adapter.sport.charAt(0).toUpperCase() + adapter.sport.slice(1)
    throw new Error(`Geen trainingsdagen ingesteld in het ${sportLabel} Profile — vul dit eerst in via Instellingen`)
  }

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

  if (mesocycli.length > 0 && huidigeGemUrenPerWeek < beschikbareUren * 0.5) {
    const oorspronkelijk = mesocycli[0].week_load_uren
    mesocycli[0].week_load_uren = Math.round(Math.max(huidigeGemUrenPerWeek * 1.1, oorspronkelijk * 0.6) * 10) / 10
    reden.push(`Eerste basisweek verzacht (${oorspronkelijk}u → ${mesocycli[0].week_load_uren}u) — huidige trainingsbelasting (~${Math.round(huidigeGemUrenPerWeek * 10) / 10}u/week) ligt fors onder het streefvolume, te snelle opbouw vergroot blessurerisico.`)
  }

  reden.push(`${mesocycli.length} weken verdeeld over mesocycli: ${[...new Set(mesocycli.map(m => m.type))].join(', ')}.`)

  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      athlete_id: userId,
      sport: adapter.sport,
      goal_id: leidendDoel?.goal_id || null,
      start_date: isoDatum(startDate),
      end_date: isoDatum(endDate),
      status: 'active',
      created_by: 'generator',
    })
    .select()
    .single()

  if (planError) throw planError

  let aantalSessies = 0
  const teGenererenWeken = Math.min(ROLLING_HORIZON_WEKEN, mesocycli.length)

  for (let weekOffset = 0; weekOffset < teGenererenWeken; weekOffset++) {
    const mesocyclusWeek = mesocycli[weekOffset]
    const sessieTypen = adapter.verdeelSessieTypen(trainingsdagen, mesocyclusWeek.type)

    for (const { dag, type } of sessieTypen) {
      const datum = volgendeDatumVoorDag(startDate, dag, weekOffset)
      const duurMinuten = Math.round((mesocyclusWeek.week_load_uren * 60) / sessieTypen.length)

      let finaalType = type
      let finaleDuur = duurMinuten
      if (type === adapter.hoogIntensiteitsType && policy.forbiddenTrainingTypes.includes('hoge_intensiteit')) {
        finaalType = adapter.vervangingBijBeperking
        reden.push(`${type} op ${dag} (week ${weekOffset + 1}) teruggebracht naar ${finaalType} — CoachPolicy verbiedt hoge intensiteit.`)
      }
      if (policy.volumeAdjustmentPct < 0) {
        finaleDuur = Math.round(duurMinuten * (1 + policy.volumeAdjustmentPct / 100))
      }

      const { error: sessieError } = await supabase
        .from('training_plan_sessions')
        .insert({
          plan_id: plan.id,
          date: isoDatum(datum),
          sport: adapter.sport,
          type: finaalType,
          duration: finaleDuur,
          intensity: null,
          load_target: mesocyclusWeek.week_load_uren / sessieTypen.length,
          status: weekOffset === 0 ? 'scheduled' : 'planned',
          // v2.4.176: bestond al (mesocyclusWeek.type), werd alleen
          // gebruikt om het sessietype te kiezen en daarna weggegooid —
          // nu ook opgeslagen zodat Today Engine/Coach het kunnen lezen
          mesocycle_type: mesocyclusWeek.type,
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

// ── Rolling Horizon-verlenging ────────────────────────────────────────────
// v2.4.248-FIX: gemeld — "training schema" ontbrak weer bij Smart
// Actions. Root cause, bevestigd met echte data: ROLLING_HORIZON_WEKEN
// (=2) genereert bij het aanmaken van een plan alleen de eerstkomende
// ~2 weken aan concrete sessies — de rest van het (tot 12 weken lange)
// plan bestaat alleen als mesocyclus-targets, GEEN dagplanning. Er was
// echter NERGENS een mechanisme dat dit venster daadwerkelijk liet
// "rollen" (doorschuiven) naarmate de tijd verstrijkt — het woord
// "rolling" stond alleen in commentaar, niet in werkende code. Cycling/
// Running liepen hierdoor letterlijk leeg (laatste sessie 30 juli/1
// augustus, vandaag 3 augustus, niets ná die datums).
//
// Deze functie reconstrueert dezelfde, deterministische mesocyclus-
// reeks uit de AL OPGESLAGEN plan-data (start_date/end_date — niet
// opnieuw uit doelen afgeleid, dat zou bij een gewijzigd doel een
// andere reeks kunnen geven dan oorspronkelijk gegenereerd) en
// genereert het eerstvolgende blok sessies vanaf waar de vorige batch
// stopte.
const VERLENG_DREMPEL_DAGEN = 7 // verleng zodra er nog maar dit veel dagen aan sessies over zijn

export async function verlengRollingHorizonIndienNodigCore(userId: string, planId: string, adapter: TrainingPlanSportAdapter): Promise<{ verlengd: boolean; aantalNieuweSessies: number }> {
  const supabase = createAdminClient()

  const { data: plan } = await supabase
    .from('training_plans').select('id, start_date, end_date, status').eq('id', planId).maybeSingle()
  if (!plan || plan.status !== 'active') return { verlengd: false, aantalNieuweSessies: 0 }

  const { data: laatsteSessie } = await supabase
    .from('training_plan_sessions').select('date')
    .eq('plan_id', planId).order('date', { ascending: false }).limit(1).maybeSingle()

  const vandaag = new Date()
  const planEindDatum = new Date(plan.end_date)
  if (planEindDatum <= vandaag) return { verlengd: false, aantalNieuweSessies: 0 } // plan is sowieso voorbij, niets te verlengen

  const laatsteSessieDatum = laatsteSessie ? new Date(laatsteSessie.date) : new Date(plan.start_date)
  const dagenOver = Math.ceil((laatsteSessieDatum.getTime() - vandaag.getTime()) / (1000 * 60 * 60 * 24))

  if (laatsteSessie && dagenOver > VERLENG_DREMPEL_DAGEN) {
    return { verlengd: false, aantalNieuweSessies: 0 } // nog genoeg sessies over, niets te doen
  }

  const [profiel, policy] = await Promise.all([adapter.haalProfiel(userId), genereerCoachPolicy(userId)])
  const trainingsdagen = profiel.trainingsdagen || []
  if (trainingsdagen.length === 0) return { verlengd: false, aantalNieuweSessies: 0 }
  const beschikbareUren = profiel.beschikbare_uren_per_week || 4

  const planStartDate = new Date(plan.start_date)
  const weekTotaal = Math.max(1, Math.ceil((planEindDatum.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)))
  const mesocycli = bepaalMesocycli(weekTotaal, beschikbareUren)

  const weekOffsetLaatsteSessie = Math.floor((laatsteSessieDatum.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
  const startWeekOffset = weekOffsetLaatsteSessie + 1
  const eindWeekOffset = Math.min(startWeekOffset + ROLLING_HORIZON_WEKEN, mesocycli.length)

  if (startWeekOffset >= mesocycli.length) return { verlengd: false, aantalNieuweSessies: 0 } // macrocyclus is al volledig gegenereerd

  let aantalNieuweSessies = 0
  for (let weekOffset = startWeekOffset; weekOffset < eindWeekOffset; weekOffset++) {
    const mesocyclusWeek = mesocycli[weekOffset]
    const sessieTypen = adapter.verdeelSessieTypen(trainingsdagen, mesocyclusWeek.type)

    for (const { dag, type } of sessieTypen) {
      const datum = volgendeDatumVoorDag(planStartDate, dag, weekOffset)
      const duurMinuten = Math.round((mesocyclusWeek.week_load_uren * 60) / sessieTypen.length)

      let finaalType = type
      let finaleDuur = duurMinuten
      if (type === adapter.hoogIntensiteitsType && policy.forbiddenTrainingTypes.includes('hoge_intensiteit')) {
        finaalType = adapter.vervangingBijBeperking
      }
      if (policy.volumeAdjustmentPct < 0) {
        finaleDuur = Math.round(duurMinuten * (1 + policy.volumeAdjustmentPct / 100))
      }

      // v2.4.259-FIX: gemeld — twee identieke sessies voor dezelfde dag.
      // Root cause: deze functie wordt vanuit meerdere plekken aangeroepen
      // (rechtstreeks via de trainingsplan-route, én automatisch via
      // Today Engine bij elke Home-load) — bij twee aanroepen kort na
      // elkaar zag de tweede nog niet dat de eerste al iets had
      // aangemaakt (race condition), en dupliceerde het hele blok.
      // Idempotency-check: vóór het invoegen, checken of er al een
      // sessie voor deze exacte datum bestaat binnen dit plan.
      const datumStr = isoDatum(datum)
      const { data: bestaandeSessie } = await supabase
        .from('training_plan_sessions').select('id')
        .eq('plan_id', plan.id).eq('date', datumStr).maybeSingle()

      if (bestaandeSessie) continue // al aangemaakt door een eerdere/gelijktijdige aanroep, overslaan

      const { error: sessieError } = await supabase
        .from('training_plan_sessions')
        .insert({
          plan_id: plan.id, date: datumStr, sport: adapter.sport,
          type: finaalType, duration: finaleDuur, intensity: null,
          load_target: mesocyclusWeek.week_load_uren / sessieTypen.length,
          status: 'planned', mesocycle_type: mesocyclusWeek.type,
        })

      // v2.4.259: een fout hier kan ook legitiem een unique-constraint-
      // conflict zijn (de database-niveau-beveiliging, zie
      // fix_duplicate_sessions.sql) — bijv. bij een écht gelijktijdige
      // aanroep die de check hierboven net vóór was. Dat is geen echte
      // fout, gewoon niet geteld als "nieuw aangemaakt".
      if (!sessieError) aantalNieuweSessies++
    }
  }

  return { verlengd: aantalNieuweSessies > 0, aantalNieuweSessies }
}
