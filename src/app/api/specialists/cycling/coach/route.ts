export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { analyseerCycling } from '@/lib/specialists/cycling-analysis'
import { COACH_CORE_IDENTITY, CORE_SAFETY_RULE, getCoachTone } from '@/core/prompts/coach-personality'

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

export interface CyclingCoachAdvies {
  samenvatting: string
  sterke_punten: string
  aandachtspunten: string
  advies: string
  generated_at: string
}

// ── Fase 3 — Cycling Coach Layer ────────────────────────────────────────
// Bron: docs/specialist-api.md Fase 3. EERSTE AI-CALL in de
// specialistlaag. Roept intern Fase 2b aan (analyseerCycling) — geen
// nieuwe berekening hier, alleen interpretatie van al-berekende cijfers.
//
// Personality: hergebruikt COACH_CORE_IDENTITY/CORE_SAFETY_RULE/
// getCoachTone(2) uit de BESTAANDE coach-personality.ts (zie
// specialist-engine-architecture.md, "Coach Personality — hergebruik,
// geen nieuwe laag"). Niveau 2 gekozen (niet 3) — dit is periodiek
// advies genereren, geen reactie op een zojuist afgeronde evaluatie
// (dat is waar Niveau 3 voor bedoeld is, zie coach-personality.ts).

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null)
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('specialist_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('specialist_type', 'cycling')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await req.json().catch(() => ({}))
    const periodDays = body.period_days || 90

    // Cache — max 1 analyse per 24 uur, zelfde patroon als progress-analysis
    const gisteren = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from('specialist_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('specialist_type', 'cycling')
      .gte('generated_at', gisteren)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) return NextResponse.json(cached)

    // ── Fase 2b aanroepen — intern, geen HTTP-roundtrip ──────────────
    const engineResultaat = await analyseerCycling(user.id, periodDays)

    // ── Doelen + voorkeuren ophalen (licht, geen Goal Engine-berekening
    // hier — die is nog niet gebouwd, bewust buiten scope van deze stap)
    const [goalsRes, profielRes] = await Promise.all([
      supabase.from('user_goals').select('title, target_value, target_date').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('specialist_profiles').select('preferences').eq('user_id', user.id).eq('specialist_type', 'cycling').single(),
    ])
    const doelen = goalsRes.data || []
    const voorkeuren = profielRes.data?.preferences || {}

    const { resultaat, reden } = engineResultaat

    const doelenContext = doelen.length > 0
      ? `\nActieve doelen van de gebruiker:\n${doelen.map(g => `- ${g.title}${g.target_value ? ` (streefwaarde: ${g.target_value})` : ''}${g.target_date ? ` (datum: ${g.target_date})` : ''}`).join('\n')}`
      : '\nGeen actieve doelen ingesteld.'

    const systemPrompt = `${COACH_CORE_IDENTITY}
${getCoachTone(2)}
${CORE_SAFETY_RULE}

Je bent nu specifiek de Cycling Coach — een specialistische kennislaag
bovenop jezelf, met diepe fietskennis. Je bent GEEN aparte coach met een
andere stem — dezelfde persoonlijkheid als hierboven, alleen met extra
vakkennis over wielrennen.

BELANGRIJK: onderstaande cijfers zijn AL BEREKEND door een deterministische
Analysis Engine (geen AI). Jij rekent zelf NIETS opnieuw uit, verzin geen
eigen getallen — je interpreteert uitsluitend wat deze cijfers betekenen
voor deze atleet.

CIJFERS (laatste ${periodDays} dagen):
- Trainingsfrequentie: ${resultaat.trainingsfrequentie.aantal_deze_periode} activiteiten (vorige periode: ${resultaat.trainingsfrequentie.aantal_vorige_periode}), trend: ${resultaat.trainingsfrequentie.trend}
- Vermogen: ${resultaat.vermogen.gemiddeld_watt ? `gemiddeld ${resultaat.vermogen.gemiddeld_watt}W` : 'geen vermogensdata'}${resultaat.vermogen.max_watt ? `, max ${resultaat.vermogen.max_watt}W` : ''}${resultaat.vermogen.trend_pct !== null ? `, trend ${resultaat.vermogen.trend_pct > 0 ? '+' : ''}${resultaat.vermogen.trend_pct}%` : ''}
- Afstand: ${resultaat.afstand.totaal_km}km totaal${resultaat.afstand.gemiddeld_km_per_activiteit ? `, gemiddeld ${resultaat.afstand.gemiddeld_km_per_activiteit}km per rit` : ''}
- Trainingsbelasting: ${resultaat.trainingsbelasting.totale_minuten} minuten totaal, score "${resultaat.trainingsbelasting.score}"

TOELICHTING BIJ DE CIJFERS (van de Analysis Engine, ter referentie):
${reden.join('\n')}
${doelenContext}

Geef een persoonlijk, motiverend maar eerlijk cycling-advies. Schrijf in
het Nederlands. Wees concreet — gebruik de cijfers, verzin niets.

Reageer ALLEEN in dit JSON-formaat:
{
  "samenvatting": "1-2 zinnen, de kern van waar deze atleet nu staat qua fietsen",
  "sterke_punten": "2-3 zinnen over wat goed gaat",
  "aandachtspunten": "2-3 zinnen over wat aandacht verdient",
  "advies": "2-3 zinnen concreet advies voor de komende periode"
}`

    let advies: CyclingCoachAdvies = {
      samenvatting: 'Nog onvoldoende data voor een cycling-samenvatting.',
      sterke_punten: 'Nog geen trend zichtbaar.',
      aandachtspunten: 'Blijf activiteiten importeren voor een vollediger beeld.',
      advies: 'Ga door met fietsen en importeer je ritten — over een paar weken kan de coach een beter beeld geven.',
      generated_at: new Date().toISOString(),
    }

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Geef je Cycling Coach-advies.' }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          advies = { ...advies, ...parsed, generated_at: new Date().toISOString() }
        }
      }
    } catch (aiErr) {
      console.error('[specialists/cycling/coach] AI-call mislukt, fallback gebruikt:', aiErr)
    }

    const { data: saved, error: saveError } = await supabase
      .from('specialist_analyses')
      .insert({
        user_id: user.id,
        specialist_type: 'cycling',
        period_days: periodDays,
        analysis: advies,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (saveError) throw saveError

    return NextResponse.json(saved)
  } catch (err) {
    console.error('[specialists/cycling/coach]', err)
    return NextResponse.json({ error: 'Advies genereren mislukt' }, { status: 500 })
  }
}
