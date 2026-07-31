export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { haalOverzichtData } from '@/lib/coach-planning-overzicht'
import { kiesTop3, type ActionProposal } from '@/lib/smart-action-engine'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── Coach Planning Fase C: Smart Actions ─────────────────────────────
// Verzamelt actie-voorstellen uit bestaande bronnen (Injuries,
// specialist-trainingsplan, Coach Planning-overzicht), geen nieuwe
// databron. Elke bron levert een vast prioriteitscijfer aan; kiesTop3()
// (100% deterministisch, geen AI) kiest de uiteindelijke top 3.
//
// v2.4.204-FIX: gebruikte voorheen bepaalTodayPlan() (de volledige
// Today Engine, inclusief de Trainer AI-vangnet-laag) — die doet bij
// "geen actief specialist-plan" een ECHTE Claude-aanroep
// (claude-haiku-4-5, in api/training/today), goed voor de ~3
// seconden vertraging die gemeld werd. Smart Actions heeft voor het
// "training vandaag"-signaal geen AI-gepersonaliseerde tekst nodig —
// alleen een snelle ja/nee. Nu: rechtstreekse databasecheck op een
// geplande specialist-sessie (geen AI-call, geen Trainer AI-vangnet
// hier). Als er geen specialist-plan is, laat Smart Actions dit
// voorstel gewoon weg — de volledige Today Engine (mét Trainer AI)
// blijft gewoon actief op de bestaande "Vandaag van je Coach"-kaart.
//
// Prioriteitstabel (bewust vastgelegd, niet impliciet):
//   98 — actieve blessure (gezondheid gaat altijd voor)
//   95 — training vandaag gepland (specialist-trainingsplan)
//   85 — wedstrijd binnen 7 dagen
//   70 — vakantie binnen 3 dagen
//   30 — altijd beschikbaar: vraag de Coach
//   20 — altijd beschikbaar: open Coach Planning

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const voorstellen: ActionProposal[] = []

    // ── Bron 1: Blessures (hoogste prioriteit — gezondheid gaat voor) ──
    const { data: blessures } = await supabase
      .from('injuries').select('body_part').eq('user_id', user.id).eq('active', true).limit(1)
    if (blessures && blessures.length > 0) {
      voorstellen.push({ icon: '🤕', label: 'Blessure bijwerken', href: '/injuries', priority: 98, bron: 'Injuries' })
    }

    // ── Bron 2: Training vandaag gepland — snelle DB-check, geen AI ────
    const vandaag = new Date()
    const vandaagStr = `${vandaag.getFullYear()}-${String(vandaag.getMonth() + 1).padStart(2, '0')}-${String(vandaag.getDate()).padStart(2, '0')}`
    const { data: actievePlannen } = await supabase
      .from('training_plans').select('id').eq('athlete_id', user.id).eq('status', 'active')
    const planIds = (actievePlannen || []).map(p => p.id)
    let training_toegevoegd = false
    if (planIds.length > 0) {
      const { data: sessieVandaag } = await supabase
        .from('training_plan_sessions').select('sport, type')
        .in('plan_id', planIds).eq('date', vandaagStr).neq('status', 'cancelled').maybeSingle()
      if (sessieVandaag) {
        voorstellen.push({
          icon: sessieVandaag.sport === 'cycling' ? '🚴' : sessieVandaag.sport === 'running' ? '🏃' : '💪',
          label: 'Start training',
          href: `/coach/${sessieVandaag.sport}/trainingsplan`,
          priority: 95, bron: 'Trainingsplan',
        })
        training_toegevoegd = true
      }
    }
    // v2.4.206-FIX: gemeld — "snelle actie naar trainingsplan is weg".
    // v2.4.204's snelheidsfix liet de Trainer AI-vangnet-laag volledig
    // weg (geen specialist-plan vandaag → geen trainingsvoorstel meer,
    // waar dat voorheen via de volledige Today Engine wél kwam). Nu:
    // als er geen specialist-sessie is, wordt de CACHE van Trainer AI
    // gelezen (coach_recommendations.training_instruction,
    // type='training_today') — als die al eerder vandaag gegenereerd
    // is (bijv. via Home's eigen /api/today-aanroep), tonen we 'm hier
    // ook, zonder zelf een nieuwe, trage AI-call te triggeren. Nog
    // steeds geen 3-seconden-vertraging — puur een snelle cache-lezing.
    if (!training_toegevoegd) {
      const { data: cacheRij } = await supabase
        .from('coach_recommendations').select('training_instruction')
        .eq('user_id', user.id).eq('date', vandaagStr).eq('type', 'training_today').maybeSingle()
      const instr = cacheRij?.training_instruction as { training_allowed?: boolean; title?: string } | null
      if (instr?.training_allowed) {
        voorstellen.push({ icon: '💪', label: instr.title || 'Start training', href: '/training', priority: 95, bron: 'Trainer AI (cache)' })
      }
    }

    // ── Bron 3: Coach Planning-overzicht — wedstrijd/vakantie ──────────
    const overzicht = await haalOverzichtData(supabase, user.id)
    if (overzicht.volgendEvenement) {
      const dagenTot = Math.round((new Date(overzicht.volgendEvenement.datum).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (dagenTot <= 7) {
        voorstellen.push({ icon: '🏁', label: 'Bekijk wedstrijdplan', href: '/coach-planning', priority: 85, bron: 'Coach Planning' })
      }
    }
    if (overzicht.volgendeVakantie) {
      const dagenTot = Math.round((new Date(overzicht.volgendeVakantie.datum).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (dagenTot <= 3) {
        voorstellen.push({ icon: '🌴', label: 'Vakantie voorbereiden', href: '/coach-planning', priority: 70, bron: 'Coach Planning' })
      }
    }

    // ── Altijd beschikbaar — vullen de resterende plekken ──────────────
    voorstellen.push({ icon: '💬', label: 'Vraag de Coach', href: '/chat', priority: 30, bron: 'Master Coach' })
    voorstellen.push({ icon: '📅', label: 'Open Coach Planning', href: '/coach-planning', priority: 20, bron: 'Coach Planning' })

    return NextResponse.json({ acties: kiesTop3(voorstellen) })
  } catch (err) {
    console.error('[smart-actions]', err)
    return NextResponse.json({ acties: [] })
  }
}
