export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { haalOverzichtData } from '@/lib/coach-planning-overzicht'
import { bepaalTodayPlan } from '@/lib/today-engine'
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
// Verzamelt actie-voorstellen uit bestaande bronnen (Injuries, Today
// Engine, Coach Planning-overzicht), geen nieuwe databron. Elke bron
// levert een vast prioriteitscijfer aan; kiesTop3() (100%
// deterministisch, geen AI) kiest de uiteindelijke top 3.
//
// Prioriteitstabel (bewust vastgelegd, niet impliciet):
//   98 — actieve blessure (gezondheid gaat altijd voor)
//   95 — training vandaag gepland (Today Engine)
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

    // ── Bron 2: Today Engine — training vandaag gepland ────────────────
    // Eigen try/catch: mag de rest van Smart Actions nooit blokkeren
    try {
      const cookieHeader = req.headers.get('cookie') || ''
      const todayPlan = await bepaalTodayPlan(user.id, cookieHeader, req.nextUrl.origin)
      if (todayPlan.source !== 'rust') {
        voorstellen.push({ icon: todayPlan.source === 'cycling' ? '🚴' : todayPlan.source === 'running' ? '🏃' : '💪', label: todayPlan.actionLabel, href: todayPlan.actionHref, priority: 95, bron: 'Today Engine' })
      }
    } catch (err) {
      console.error('[smart-actions] Today Engine ophalen mislukt:', err)
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
