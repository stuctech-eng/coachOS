export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

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

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    const dertig = new Date()
    dertig.setDate(dertig.getDate() - 30)
    const vanDatum = dertig.toISOString().split('T')[0]

    const [checkinsRes, metricsRes, activiteitenRes, statusRes, existingRes] = await Promise.all([
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('health_metrics').select('date, hrv, resting_hr, sleep_duration, steps').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('activity_sessions').select('date, duration, activities(name)').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('daily_status').select('date, coach_score, recovery_score, training_score, risk_flags').eq('user_id', user.id).gte('date', vanDatum).order('date'),
      supabase.from('coach_memory').select('content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
    ])

    const checkins = checkinsRes.data || []
    const metrics = metricsRes.data || []
    const activiteiten = activiteitenRes.data || []
    const statussen = statusRes.data || []
    const bestaand = existingRes.data || []

    if (checkins.length < 5 && metrics.length < 5) {
      return NextResponse.json({ message: 'Nog te weinig data voor patronen' })
    }

    const checkinTekst = checkins.map(c =>
      `${c.date}: gevoel ${c.feeling_score}/10, energie ${c.energy_score}/10${c.has_pain ? ', pijn' : ''}${c.notes ? ` — ${c.notes}` : ''}`
    ).join('\n')

    const metricsTekst = metrics.map(m =>
      `${m.date}: ${[m.hrv ? `HRV ${m.hrv}ms` : '', m.resting_hr ? `RHR ${m.resting_hr}bpm` : '', m.sleep_duration ? `slaap ${m.sleep_duration}u` : '', m.steps ? `${m.steps} stappen` : ''].filter(Boolean).join(', ')}`
    ).join('\n')

    const activiteitenTekst = activiteiten.map(a => {
      const act = a.activities as { name: string } | { name: string }[] | null
      const naam = Array.isArray(act) ? act[0]?.name : act?.name || 'Activiteit'
      return `${a.date}: ${naam} ${a.duration}min`
    }).join('\n')

    const statusTekst = statussen.map(s =>
      `${s.date}: coach ${s.coach_score}, herstel ${s.recovery_score}${s.risk_flags?.length ? `, risicos: ${(s.risk_flags as string[]).join(', ')}` : ''}`
    ).join('\n')

    const bestaandTekst = bestaand.length > 0 ? bestaand.map(m => `- ${m.content}`).join('\n') : 'Geen bestaande patronen'

    const systemPrompt = `Je bent een AI coach die langetermijnpatronen detecteert in gezondheids- en trainingsdata.

Analyseer de data van de laatste 30 dagen en detecteer maximaal 4 NIEUWE, SPECIFIEKE patronen.

CHECK-INS:
${checkinTekst || 'Geen data'}

GEZONDHEIDSDATA:
${metricsTekst || 'Geen data'}

ACTIVITEITEN:
${activiteitenTekst || 'Geen data'}

COACH SCORES:
${statusTekst || 'Geen data'}

BESTAANDE PATRONEN (niet herhalen):
${bestaandTekst}

REGELS:
- Detecteer alleen patronen die BEWEZEN zijn door meerdere datapunten
- Geen voor de hand liggende conclusies
- Wees specifiek: niet "slaap is belangrijk" maar "HRV daalt consistent na nachten korter dan 6u"
- Patronen over trainingsreactie, herstel, leefstijl en prestatie zijn het waardevolst
- Genereer ALLEEN nieuwe patronen die nog niet in de bestaande lijst staan
- Geef lege array als er geen nieuwe betrouwbare patronen zijn

Reageer ALLEEN in dit JSON formaat:
{
  "insights": [
    { "content": "Specifiek patroon beschrijving", "confidence": 80, "type": "pattern" }
  ]
}

Types: pattern / warning / achievement / preference
Confidence: 0-100`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiResponse = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Analyseer de data en detecteer nieuwe patronen.' }],
      }),
    })

    const aiData = await aiResponse.json()
    const rawText = aiData.content?.[0]?.text || ''

    let insights: Array<{ content: string; confidence: number; type: string }> = []
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        insights = parsed.insights || []
      }
    } catch {
      return NextResponse.json({ message: 'Geen nieuwe patronen gevonden' })
    }

    if (insights.length === 0) {
      return NextResponse.json({ message: 'Geen nieuwe patronen gevonden' })
    }

    // Deduplicatie
    const bestaandContent = bestaand.map(m => m.content.toLowerCase())
    const nieuweInsights = insights.filter(insight =>
      !bestaandContent.some(b => b.includes(insight.content.toLowerCase().slice(0, 30)))
    )

    if (nieuweInsights.length === 0) {
      return NextResponse.json({ message: 'Alle patronen al bekend' })
    }

    await supabase.from('coach_memory').insert(
      nieuweInsights.map(insight => ({
        user_id: user.id,
        memory_type: insight.type || 'pattern',
        content: insight.content,
        confidence: insight.confidence,
      }))
    )

    return NextResponse.json({
      message: `${nieuweInsights.length} nieuwe patronen opgeslagen`,
      insights: nieuweInsights.length,
    })

  } catch (error) {
    console.error('Memory 2.0 error:', error)
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json([])
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('coach_memory')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}
