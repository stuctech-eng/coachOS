export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { analyseerRunningRit } from '@/lib/specialists/running-rit-analyse'
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

function formatPace(secPerKm: number | null): string {
  if (!secPerKm) return 'onbekend'
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}

// ── Running Ritanalyse-route — Fase 2 (Professional) ────────────────────
// Zelfde patroon als Cycling's ritanalyse: eerst een volledig
// deterministische analyse (analyseerRunningRit), dan pas de AI die dat
// omzet in leesbare feedback. AI beslist niets, interpreteert alleen.

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const { activity_id } = body
    if (!activity_id) return NextResponse.json({ error: 'activity_id is verplicht' }, { status: 400 })

    const analyse = await analyseerRunningRit(user.id, activity_id)

    const systemPrompt = `${COACH_CORE_IDENTITY}
${getCoachTone(2)}
${CORE_SAFETY_RULE}

Je bent de Running Coach en analyseert een net afgeronde duurloop. BELANGRIJK:
de feiten hieronder zijn AL BEPAALD door deterministische berekeningen —
jij verzint geen zones, cijfers of "volgens schema"-oordelen, je legt
uitsluitend uit wat er al is vastgesteld.

VASTGESTELDE FEITEN OVER DEZE LOOP:
${analyse.pacezone ? `- Pace-zone: ${analyse.pacezone.naam} (${formatPace(analyse.pacezone.pace_sec_per_km)})` : '- Geen pace-zone te bepalen (ontbrekende VDOT of pace-data)'}
${analyse.hartslagzone ? `- Hartslagzone: Zone ${analyse.hartslagzone.zone} (${analyse.hartslagzone.naam})` : '- Geen hartslagzone te bepalen (ontbrekende max hartslag of hartslagdata)'}
${analyse.cadans_beoordeling ? `- Cadans: ${analyse.cadans_beoordeling} (score ${analyse.cadans_score}/100)` : '- Geen cadansdata beschikbaar'}
${analyse.split ? `- Split: ${analyse.split.type === 'negative_split' ? 'negative split (tweede helft sneller)' : analyse.split.type === 'positive_split' ? 'positive split (tweede helft langzamer)' : 'gelijkmatig getempoed'} (${analyse.split.verschil_pct}%), pacing-consistentie ${analyse.split.pacing_consistentie_score}/100` : '- Geen split-data beschikbaar (te korte afstand of geen GPS-tijdreeks)'}
${analyse.hoogtemeters !== null ? `- Hoogtemeters: ${Math.round(analyse.hoogtemeters)}m` : ''}
${analyse.running_power_watt ? `- Running Power: ${Math.round(analyse.running_power_watt)}W` : ''}
${analyse.geschatte_tss !== null ? `- Geschatte trainingsbelasting: ${analyse.geschatte_tss} TSS (intensiteit ${analyse.intensity_factor})` : ''}
${analyse.coach_policy_conclusie ? `- Huidige herstelstatus: ${analyse.coach_policy_conclusie.recoveryState} (max intensiteit vandaag: ${analyse.coach_policy_conclusie.maxIntensity})` : ''}
${analyse.geplande_sessie
  ? `- Gepland stond: ${analyse.geplande_sessie.type}, ${analyse.geplande_sessie.duration} minuten. ${analyse.volgens_schema ? 'Deze loop valt binnen de verwachte duur.' : 'Deze loop wijkt qua duur af van wat gepland stond.'}`
  : '- Geen geplande training gevonden voor deze datum om mee te vergelijken.'}

Schrijf een korte (3-5 zinnen), motiverende en concrete evaluatie in het
Nederlands. Behandel: wat ging goed, wat verdient aandacht, en of dit
gecontinueerd kan worden of dat er iets moet veranderen. Gebruik geen
technisch jargon als "zone-classificatie" — vertaal naar gewone taal.

Reageer ALLEEN in dit JSON-formaat:
{ "evaluatie": "je tekst hier" }`

    let evaluatie = 'Goed gelopen! Blijf consistent trainen, dat is de basis van vooruitgang.'

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
          messages: [{ role: 'user', content: 'Evalueer deze duurloop.' }],
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
      console.error('[running/rit-analyse] AI-call mislukt, fallback gebruikt:', aiErr)
    }

    return NextResponse.json({ analyse, evaluatie })
  } catch (err) {
    console.error('[running/rit-analyse]', err)
    return NextResponse.json({ error: (err as Error).message || 'Analyse mislukt' }, { status: 500 })
  }
}
