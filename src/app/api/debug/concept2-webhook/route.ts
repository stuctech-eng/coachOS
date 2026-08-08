export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import {
  type Concept2Result,
  haalOfMaakRoeiActiviteit,
  verwerkConcept2Resultaat,
} from '@/lib/specialists/concept2-result-processor'
import type { GeleerdPatroon } from '@/core/athlete-platform/learned-adjustments'

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

// ── Concept2-webhook Debug Simulator ─────────────────────────────────────
// Bron: v2.4.286 (Concept2-webhook), test-verzoek gebruiker 5 augustus
// 2026 na het pushen van de webhook-code.
//
// EERLIJKE GRENS, expliciet: dit test NIET het geheime pad-segment zelf
// (CONCEPT2_WEBHOOK_SECRET) — dat vergt een echte HTTP-aanroep naar
// `/api/webhooks/concept2/<secret>` van buitenaf, niet iets wat een
// ingelogde debug-pagina zinvol kan nadoen zonder de beveiliging zelf
// te omzeilen. Wat dit WEL test, 1-op-1 hetzelfde als de echte webhook:
// 1. Staat `concept2_tokens.concept2_user_id` gevuld? (zonder dit kan
//    de echte webhook de gebruiker nooit herkennen — vaak de eerste
//    reden waarom "het doet niks" bij een bestaande, oude koppeling)
// 2. Werkt de volledige verwerking (insert/matching/Coach Decision
//    Engine/dedup) — via exact dezelfde `verwerkConcept2Resultaat()`
//    die de echte webhook ook aanroept, geen aparte testlogica

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const { data: tokenRij } = await supabase
      .from('concept2_tokens')
      .select('concept2_user_id, access_token')
      .eq('user_id', user.id)
      .maybeSingle()

    // v2.4.304 (Activiteiten-scherm, Concept2-deep-link-verificatie):
    // haalt één echte, bestaande activity_session met source='concept2'
    // op, extraheert het result-ID uit notes ('concept2:{id}'), en bouwt
    // de kandidaat-URL — puur ter handmatige controle door de gebruiker
    // (tik 'm aan, kijk of de juiste training opent), NIET om automatisch
    // aan te nemen dat het klopt.
    const { data: voorbeeldActiviteit } = await supabase
      .from('activity_sessions')
      .select('id, date, notes')
      .eq('user_id', user.id).eq('source', 'concept2')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let concept2DeepLinkCheck: { resultId: string | null; kandidaatUrl: string | null; datum: string | null } | null = null
    if (voorbeeldActiviteit) {
      const match = voorbeeldActiviteit.notes?.match(/concept2:(\d+)/)
      const resultId = match ? match[1] : null
      concept2DeepLinkCheck = {
        resultId,
        datum: voorbeeldActiviteit.date,
        kandidaatUrl: (tokenRij?.concept2_user_id && resultId)
          ? `https://log.concept2.com/profile/${tokenRij.concept2_user_id}/log/${resultId}`
          : null,
      }
    }

    return NextResponse.json({
      concept2Gekoppeld: !!tokenRij,
      concept2UserId: tokenRij?.concept2_user_id ?? null,
      klaarVoorWebhook: !!tokenRij?.concept2_user_id,
      concept2DeepLinkCheck,
    })
  } catch (err) {
    console.error('[debug/concept2-webhook GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await request.json().catch(() => ({})) as { duurMinuten?: number; datum?: string }
    const duurMinuten = body.duurMinuten || 30
    const datum = body.datum || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    // Stap 1 — exact wat de echte webhook ook als eerste doet: het
    // Concept2 user-id opzoeken. Als dit leeg is, stopt de simulator
    // hier ook — geen zin om verder te doen, dat zou een test zijn die
    // niet representatief is voor de echte webhook.
    const { data: tokenRij } = await supabase
      .from('concept2_tokens').select('concept2_user_id')
      .eq('user_id', user.id).maybeSingle()

    if (!tokenRij?.concept2_user_id) {
      return NextResponse.json({
        stap: 'concept2_user_id-lookup',
        geslaagd: false,
        reden: 'concept2_user_id is leeg — dit is exact waarom de echte webhook deze gebruiker niet zou herkennen. Meest waarschijnlijke oorzaak: Concept2-koppeling is niet opnieuw verbonden sinds v2.4.286 (de GET /api/users/me-aanroep in callback/route.ts is toen pas toegevoegd).',
      })
    }

    // Stap 2 — synthetisch Concept2-resultaat, met een 'debug-'-
    // voorvoegsel-id zodat deze nooit met een echt Concept2-resultaat
    // kan botsen bij de idempotency-check.
    const syntheticId = Date.now() // uniek genoeg binnen dit debug-doel
    const resultaat: Concept2Result = {
      id: syntheticId,
      date: `${datum} 00:00:00`,
      distance: Math.round(duurMinuten * 200), // ruwe schatting, puur voor het debug-scherm
      type: 'rower',
      time: duurMinuten * 600, // Concept2-eenheid: tienden van een seconde
      workout_type: 'FixedTimeSplits',
    }

    const activiteitId = await haalOfMaakRoeiActiviteit(supabase, user.id)

    const { data: geleerdePatronenData } = await supabase
      .from('learned_patterns').select('effect_pad, aanpassing_percentage').eq('user_id', user.id).eq('sport', 'rowing')
    const geleerdePatronen: GeleerdPatroon[] = geleerdePatronenData || []

    // Stap 3 — exact dezelfde functie die de echte webhook aanroept.
    const uitkomst = await verwerkConcept2Resultaat(supabase, user.id, activiteitId, resultaat, geleerdePatronen)

    return NextResponse.json({
      stap: 'volledige verwerking',
      geslaagd: uitkomst.status === 'geimporteerd',
      uitkomst,
      concept2UserIdGebruikt: tokenRij.concept2_user_id,
      syntheticResultId: syntheticId,
    })
  } catch (err) {
    console.error('[debug/concept2-webhook POST]', err)
    return NextResponse.json({ error: 'Test mislukt' }, { status: 500 })
  }
}
