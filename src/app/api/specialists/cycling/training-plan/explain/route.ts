export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'
import { COACH_CORE_IDENTITY, CORE_SAFETY_RULE, getCoachTone } from '@/core/prompts/coach-personality'
import { isoDatum } from '@/utils'

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

// ── Coach-uitleglaag — Adaptive Training Plan Engine, Fase 2 ────────────
// Bron: docs/adaptive-training-plan-decision-contract-v1.md, sectie 5:
// "AI ontvangt: decision + reason code + context. AI produceert: de
// menselijke uitleg. AI beslist NIETS."
//
// Leest de sessie van vandaag (type, duur, reason code indien
// aangepast) + de actuele CoachPolicy, en laat de AI dat omzetten in
// natuurlijke taal — exact het voorbeeld uit de hoofdspec:
// "Vandaag: D1 duurtraining, 75 minuten... Waarom? ✔ Herstel voldoende"
//
// v2.4.97-verbetering t.o.v. de test-bevinding: de stille volume-
// reductie (CoachPolicy volumeAdjustmentPct, die al werd toegepast in
// Fase 1 maar niet werd uitgelegd) wordt nu EXPLICIET als context
// meegegeven — de AI kan 'm dus benoemen, in plaats van dat 'ie
// onvermeld blijft.

const REASON_CODE_UITLEG: Record<string, string> = {
  missed_session: 'een eerder geplande training is gemist en is verplaatst naar vandaag',
  fatigue_detected: 'de herstelwaarden van vandaag waren laag, de geplande zware training is verzacht',
  injury_protection: 'er is een actieve blessure — intensieve training is vervangen door een veiligere variant',
  vacation_mode: 'onbeschikbare dagen zijn verwerkt in het schema',
  goal_change: 'het doel is gewijzigd, het hele trainingsplan is opnieuw opgebouwd',
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const vandaag = isoDatum(new Date())

    const { data: plan } = await supabase
      .from('training_plans')
      .select('id')
      .eq('athlete_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan) return NextResponse.json({ error: 'Geen actief trainingsplan — genereer er eerst één' }, { status: 404 })

    const { data: sessie } = await supabase
      .from('training_plan_sessions')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('date', vandaag)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sessie) return NextResponse.json({ sessie: null, uitleg: null, info: 'Geen training gepland voor vandaag' })

    // Cache: al uitgelegd vandaag én sindsdien niet meer gewijzigd
    if (sessie.explanation && sessie.explained_at && new Date(sessie.explained_at) >= new Date(sessie.updated_at)) {
      return NextResponse.json({ sessie, uitleg: sessie.explanation })
    }

    const policy = await genereerCoachPolicy(user.id)

    // v2.4.97: stille volume-reductie expliciet zichtbaar maken —
    // load_target staat in UREN (baseline, vóór policy-aanpassing),
    // duration staat in MINUTEN (na aanpassing, wat daadwerkelijk
    // gepland staat). Verschil = wat er eerder al stil gebeurde.
    const baselineMinuten = sessie.load_target ? Math.round(sessie.load_target * 60) : sessie.duration
    const isVolumeVerlaagd = baselineMinuten > sessie.duration + 2 // kleine marge voor afrondingsverschillen

    const reasonUitleg = sessie.adjustment_reason ? REASON_CODE_UITLEG[sessie.adjustment_reason] : null

    const systemPrompt = `${COACH_CORE_IDENTITY}
${getCoachTone(2)}
${CORE_SAFETY_RULE}

Je bent de Cycling Coach en legt een al-vastgestelde trainingsbeslissing
uit aan de gebruiker. BELANGRIJK: de beslissing zelf staat al vast —
type training, duur, en de reden ervoor zijn AL BEPAALD door
deterministische logica (Plan Generator + Daily Adjustment Layer). Jij
verzint NIETS en wijzigt NIETS — je zet uitsluitend de al-genomen
beslissing om in een korte, motiverende, menselijke uitleg.

VANDAAG GEPLAND:
- Type: ${sessie.type}
- Duur: ${sessie.duration} minuten
${sessie.adjustment_reason ? `- Deze sessie is aangepast. Reden (reason code): ${sessie.adjustment_reason} — concreet: ${reasonUitleg}` : '- Deze sessie is ongewijzigd volgens het oorspronkelijke plan.'}

ACTUELE COACHPOLICY (vandaags herstelcontext, al bepaald, niet zelf herberekenen):
- Herstelstatus: ${policy.recoveryState}
- Maximale intensiteit vandaag: ${policy.maxIntensity}
- Volume-aanpassing: ${policy.volumeAdjustmentPct === 0 ? 'geen aanpassing' : `${policy.volumeAdjustmentPct}%`}
- Reden: ${policy.reasons.join('; ')}
${isVolumeVerlaagd ? `\nDeze sessie is qua duur aangepast: oorspronkelijk gepland op ${baselineMinuten} minuten, nu ${sessie.duration} minuten — vanwege de volume-aanpassing hierboven. Noem dit gewoon als een normale, verstandige coachbeslissing (bijv. "ik heb 'm vandaag wat ingekort naar ${sessie.duration} minuten, gezien je herstel"). Geen dramatische taal, geen suggestie dat dit een geheim was — dit is een doodnormale coachkeuze.` : ''}

Schrijf een korte, motiverende uitleg (3-5 zinnen) in het Nederlands.
Gebruik geen technische termen als "reason code" of "CoachPolicy" — vertaal
dat naar gewone taal. Wees eerlijk en concreet, geen vage algemeenheden.

Reageer ALLEEN in dit JSON-formaat:
{ "uitleg": "je tekst hier" }`

    let uitleg = `${sessie.type === 'herstel' ? 'Een rustige hersteldag vandaag' : `${sessie.duration} minuten ${sessie.type}`} — ga ervoor!`

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
          messages: [{ role: 'user', content: 'Leg de training van vandaag uit.' }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (typeof parsed.uitleg === 'string' && parsed.uitleg.trim()) {
            uitleg = parsed.uitleg.trim()
          }
        }
      }
    } catch (aiErr) {
      console.error('[training-plan/explain] AI-call mislukt, fallback gebruikt:', aiErr)
    }

    await supabase
      .from('training_plan_sessions')
      .update({ explanation: uitleg, explained_at: new Date().toISOString() })
      .eq('id', sessie.id)

    return NextResponse.json({ sessie, uitleg })
  } catch (err) {
    console.error('[training-plan/explain]', err)
    return NextResponse.json({ error: 'Uitleg genereren mislukt' }, { status: 500 })
  }
}
