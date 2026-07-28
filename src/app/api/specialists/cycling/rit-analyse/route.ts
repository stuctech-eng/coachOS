export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { analyseerRit } from '@/lib/specialists/cycling-rit-analyse'
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

// ── Ritanalyse-route — Fase 2f ────────────────────────────────────────
// Zelfde patroon als de Coach-uitleglaag (Fase 2a): eerst een volledig
// deterministische analyse (analyseerRit), dan pas de AI die dat omzet
// in leesbare feedback. AI beslist niets, interpreteert alleen.
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const { activity_id } = body
    if (!activity_id) return NextResponse.json({ error: 'activity_id is verplicht' }, { status: 400 })

    const analyse = await analyseerRit(user.id, activity_id)

    const systemPrompt = `${COACH_CORE_IDENTITY}
${getCoachTone(2)}
${CORE_SAFETY_RULE}

Je bent de Cycling Coach en analyseert een net afgeronde rit. BELANGRIJK:
de feiten hieronder zijn AL BEPAALD door deterministische berekeningen —
jij verzint geen zones, cijfers of "volgens schema"-oordelen, je legt
uitsluitend uit wat er al is vastgesteld.

VASTGESTELDE FEITEN OVER DEZE RIT:
${analyse.vermogenszone ? `- Vermogenszone: Zone ${analyse.vermogenszone.zone} (${analyse.vermogenszone.naam})` : '- Geen vermogenszone te bepalen (ontbrekende FTP of vermogensdata)'}
${analyse.hartslagzone ? `- Hartslagzone: Zone ${analyse.hartslagzone.zone} (${analyse.hartslagzone.naam})` : '- Geen hartslagzone te bepalen (ontbrekende max hartslag of hartslagdata)'}
${analyse.cadans_beoordeling ? `- Cadans: ${analyse.cadans_beoordeling}` : '- Geen cadansdata beschikbaar'}
${analyse.geplande_sessie
  ? `- Gepland stond: ${analyse.geplande_sessie.type}, ${analyse.geplande_sessie.duration} minuten. Werkelijke duur: ${analyse.werkelijke_duur_minuten} minuten. ${analyse.volgens_schema ? 'Dit valt binnen de verwachte duur.' : analyse.afwijking_richting === 'langer' ? `Dit is LANGER dan gepland (${analyse.werkelijke_duur_minuten} t.o.v. ${analyse.geplande_sessie.duration} minuten) — gebruik deze richting exact, verzin geen andere.` : `Dit is KORTER dan gepland (${analyse.werkelijke_duur_minuten} t.o.v. ${analyse.geplande_sessie.duration} minuten) — gebruik deze richting exact, verzin geen andere.`}`
  : `- Geen geplande training gevonden voor deze datum om mee te vergelijken. Werkelijke duur: ${analyse.werkelijke_duur_minuten} minuten.`}

Schrijf een korte (3-5 zinnen), motiverende en concrete rit-evaluatie in
het Nederlands. Behandel: wat ging goed, wat verdient aandacht, en of dit
gecontinueerd kan worden of dat er iets moet veranderen. Gebruik geen
technisch jargon als "zone-classificatie" — vertaal naar gewone taal.

Reageer ALLEEN in dit JSON-formaat:
{ "evaluatie": "je tekst hier" }`

    let evaluatie = 'Goed gereden! Blijf consistent trainen, dat is de basis van vooruitgang.'

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
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Evalueer deze rit.' }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (typeof parsed.evaluatie === 'string' && parsed.evaluatie.trim()) {
            evaluatie = parsed.evaluatie.trim()
          }
        }
      }
    } catch (aiErr) {
      console.error('[cycling/rit-analyse] AI-call mislukt, fallback gebruikt:', aiErr)
    }

    return NextResponse.json({ analyse, evaluatie })
  } catch (err) {
    console.error('[cycling/rit-analyse]', err)
    return NextResponse.json({ error: (err as Error).message || 'Analyse mislukt' }, { status: 500 })
  }
}
