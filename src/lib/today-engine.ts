import { createAdminClient } from '@/lib/supabase'

// ── Today Engine ──────────────────────────────────────────────────────
// Bron: overleg 22 juli 2026. "De Today Engine maakt zelf nooit
// trainingen. Hij kiest alleen welke bron vandaag de waarheid is." —
// dat is de kern van dit bestand, letterlijk.
//
// VASTE HIËRARCHIE (platformregel, niet alleen voor Cycling/Running):
// 1. Veiligheid — CoachPolicy/blessures/herstel (al elders geborgd,
//    Today Engine herberekent dit niet, leest alleen de uitkomst)
// 2. Specialist-trainingsplan (Cycling/Running nu, later Rowing/
//    Kettlebell/etc. zodra die specialisten bestaan) — wint als er een
//    actief plan met een sessie voor vandaag is
// 3. Trainer AI (Universal Training Engine) — alleen als er GEEN
//    actief specialist-plan is voor vandaag
// 4. Handmatige bibliotheekkeuze — buiten de Today Engine om, de
//    gebruiker kiest dan zelf bewust een module
//
// Dit voorkomt dat twee systemen elkaar tegenspreken — precies het
// probleem dat werd gevonden: de Trainer AI-route (api/training/today)
// kon onafhankelijk van het Specialist-trainingsplan ook een Cycling/
// Running-sessie voorstellen, zonder van elkaars bestaan te weten.

export interface TodayPlan {
  source: 'cycling' | 'running' | 'trainer' | 'rust'
  title: string
  duration: number | null
  intensity: 'licht' | 'matig' | 'hoog' | null
  reason: string
  coachMessage: string
  // Waar de "Start"-knop naartoe moet linken — verschilt per bron
  actionHref: string
  actionLabel: string
}

interface TrainingPlanSessie {
  id: string
  type: string
  duration: number
  status: string
  adjustment_reason: string | null
}

const SPORT_LABELS: Record<string, string> = {
  interval: 'Interval', duurtraining: 'Duurtraining', lange_duurtraining: 'Lange duurtraining', herstel: 'Herstel', // cycling
  easy_run: 'Easy Run', lange_duurloop: 'Lange duurloop', tempo: 'Tempo', // running (interval/herstel gedeeld)
}

async function haalSpecialistSessieVanVandaag(userId: string, sport: 'cycling' | 'running', vandaag: string): Promise<TrainingPlanSessie | null> {
  const supabase = createAdminClient()

  const { data: actievePlannen } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', userId)
    .eq('sport', sport)
    .eq('status', 'active')

  const planIds = (actievePlannen || []).map(p => p.id)
  if (planIds.length === 0) return null

  const { data: sessie } = await supabase
    .from('training_plan_sessions')
    .select('id, type, duration, status, adjustment_reason')
    .eq('date', vandaag)
    .in('plan_id', planIds)
    .neq('status', 'cancelled')
    .maybeSingle()

  return sessie || null
}

export async function bepaalTodayPlan(userId: string, cookieHeader: string): Promise<TodayPlan> {
  const supabase = createAdminClient()
  const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

  // ── Laag 1: veiligheid — leest de al-bepaalde Coach-beslissing (rust/
  // herstel/trainen), herberekent CoachPolicy niet opnieuw ────────────
  const { data: coachRec } = await supabase
    .from('coach_recommendations')
    .select('actie_type')
    .eq('user_id', userId).eq('date', vandaag).eq('type', 'coach')
    .maybeSingle()
  const actieType = coachRec?.actie_type as 'trainen' | 'herstel' | 'rust' | undefined

  if (actieType === 'rust') {
    return {
      source: 'rust', title: 'Rustdag', duration: null, intensity: null,
      reason: 'Coach adviseert vandaag volledige rust',
      coachMessage: 'Vandaag is herstel de training. Geen sportieve inspanning gepland.',
      actionHref: '/coach', actionLabel: 'Bekijk Coach-advies',
    }
  }

  // ── Laag 2: Specialist-trainingsplan — wint als het er is ───────────
  const [cyclingSessie, runningSessie] = await Promise.all([
    haalSpecialistSessieVanVandaag(userId, 'cycling', vandaag),
    haalSpecialistSessieVanVandaag(userId, 'running', vandaag),
  ])

  const specialistSessie = cyclingSessie || runningSessie
  const specialistSport: 'cycling' | 'running' | null = cyclingSessie ? 'cycling' : runningSessie ? 'running' : null

  if (specialistSessie && specialistSport) {
    const intensiteit: TodayPlan['intensity'] = specialistSessie.type === 'interval' ? 'hoog'
      : specialistSessie.type === 'herstel' ? 'licht' : 'matig'
    return {
      source: specialistSport,
      title: SPORT_LABELS[specialistSessie.type] || specialistSessie.type,
      duration: specialistSessie.duration,
      intensity: intensiteit,
      reason: `Onderdeel van je ${specialistSport === 'cycling' ? 'Cycling' : 'Running'}-trainingsplan`,
      coachMessage: specialistSessie.adjustment_reason
        ? 'Deze sessie is aangepast op basis van je herstel — zie het trainingsplan voor de volledige uitleg.'
        : 'Volgens schema — ga ervoor!',
      actionHref: `/coach/${specialistSport}/trainingsplan`,
      actionLabel: 'Open trainingsplan',
    }
  }

  // ── Laag 3: Trainer AI — alleen als er geen specialist-plan is ─────
  // Bewust GEEN eigen trainingslogica hier — roept de bestaande,
  // al-geteste api/training/today aan (interne server-naar-server-call).
  // Dat voorkomt duplicatie van de complexe module-keuze/AI-generatie
  // die daar al staat.
  try {
    // v2.4.169-fix: NEXT_PUBLIC_SITE_URL bestaat nergens in dit project
    // (zelf verzonnen, niet gezet in Vercel) — VERCEL_URL is de
    // automatisch door Vercel beschikbaar gestelde variabele, geen
    // handmatige configuratie nodig. Lokaal (geen VERCEL_URL) valt
    // terug op localhost.
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    // v2.4.169: POST i.p.v. GET — GET leest alleen de cache (kan null
    // zijn als er vandaag nog niets gegenereerd is), POST genereert
    // indien nodig én cachet. Geeft de echte cookie-header van het
    // oorspronkelijke verzoek door (van api/today/route.ts) — zonder
    // geldige sessie-cookie zou dit intern altijd "niet ingelogd" geven.
    const trainerRes = await fetch(`${baseUrl}/api/training/today`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({}),
    })
    if (trainerRes.ok) {
      const data = await trainerRes.json()
      const instr = data.instruction
      if (instr && instr.training_allowed) {
        return {
          source: 'trainer',
          title: instr.title || 'Training',
          duration: instr.duration,
          intensity: instr.intensity === 'heavy' ? 'hoog' : instr.intensity === 'medium' ? 'matig' : 'licht',
          reason: instr.reason || 'Trainer AI-sessie',
          coachMessage: instr.coach_message || 'Veel succes met je training!',
          actionHref: '/training', actionLabel: 'Start Training',
        }
      }
    }
  } catch (err) {
    console.error('[today-engine] Trainer AI ophalen mislukt:', err)
  }

  // Geen enkele bron leverde iets op — nette lege staat, geen gok
  return {
    source: 'rust', title: 'Geen training gepland', duration: null, intensity: null,
    reason: 'Geen actief trainingsplan en Trainer AI kon geen sessie bepalen',
    coachMessage: 'Wil je toch trainen? Kies zelf een module in de bibliotheek.',
    actionHref: '/training', actionLabel: 'Bibliotheek openen',
  }
}
