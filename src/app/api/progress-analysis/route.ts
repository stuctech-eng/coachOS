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

export interface ProgressAnalysis {
  kracht: string
  conditie: string
  herstel: string
  compliance: string
  risicos: string
  focus: string
  samenvatting: string
  generated_at: string
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null)
    const supabase = createAdminClient()

    // Haal meest recente analyse op
    const { data } = await supabase
      .from('progress_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    // Check cache — max 1 analyse per 24 uur
    const gisteren = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from('progress_analyses')
      .select('*')
      .eq('user_id', user.id)
      .gte('generated_at', gisteren)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) return NextResponse.json(cached)

    // Data ophalen
    const zestigDagenGeleden = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const dertigDagenGeleden = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [profileRes, trainingsRes, exerciseRes, complianceCallsRes, coachCallsRes] = await Promise.all([
      supabase.from('profiles').select('first_name, experience_level').eq('user_id', user.id).single(),
      supabase.from('training_results')
        .select('training_type, actual_duration, rating, perceived_effort, completed_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('completed_at', zestigDagenGeleden)
        .order('completed_at', { ascending: true }),
      supabase.from('exercise_records')
        .select('exercise_name, module, weight_kg, reps, duration_sec, performed_at')
        .eq('user_id', user.id)
        .gte('performed_at', zestigDagenGeleden)
        .order('performed_at', { ascending: true }),
      supabase.from('coach_recommendations')
        .select('actie_type, date')
        .eq('user_id', user.id)
        .eq('type', 'coach')
        .gte('date', dertigDagenGeleden.split('T')[0]),
      supabase.from('coach_calls')
        .select('date, coach_call_items(sport_type, rating, mood, status)')
        .eq('user_id', user.id)
        .gte('date', dertigDagenGeleden.split('T')[0])
        .order('date', { ascending: false })
        .limit(20),
    ])

    const profile = profileRes.data
    const trainingen = trainingsRes.data || []
    const exerciseRecords = exerciseRes.data || []
    const coachAdviezen = complianceCallsRes.data || []
    const coachCalls = coachCallsRes.data || []

    // Bereken statistieken
    const totaalTrainingen = trainingen.length
    const gemRpe = trainingen.filter(t => t.perceived_effort).length > 0
      ? Math.round(trainingen.filter(t => t.perceived_effort).reduce((a, t) => a + (t.perceived_effort || 0), 0) / trainingen.filter(t => t.perceived_effort).length * 10) / 10
      : null
    const totaalMinuten = trainingen.reduce((a, t) => a + (t.actual_duration || 0), 0)

    // Module verdeling
    const moduleCount: Record<string, number> = {}
    for (const t of trainingen) {
      const type = t.training_type || 'onbekend'
      moduleCount[type] = (moduleCount[type] || 0) + 1
    }

    // Oefening trends
    const oefeningGroepen: Record<string, Array<{ gewicht: number | null; reps: number | null; datum: string }>> = {}
    for (const rec of exerciseRecords) {
      if (!oefeningGroepen[rec.exercise_name]) oefeningGroepen[rec.exercise_name] = []
      oefeningGroepen[rec.exercise_name].push({
        gewicht: rec.weight_kg,
        reps: rec.reps,
        datum: rec.performed_at,
      })
    }

    const trendRegels: string[] = []
    for (const [naam, records] of Object.entries(oefeningGroepen)) {
      if (records.length < 2) continue
      const eerste = records[0]
      const laatste = records[records.length - 1]
      if (eerste.gewicht && laatste.gewicht && eerste.gewicht !== laatste.gewicht) {
        const pct = Math.round(((laatste.gewicht - eerste.gewicht) / eerste.gewicht) * 100)
        trendRegels.push(`${naam}: ${eerste.gewicht}kg → ${laatste.gewicht}kg (${pct > 0 ? '+' : ''}${pct}%)`)
      } else if (eerste.reps && laatste.reps && eerste.reps !== laatste.reps) {
        const pct = Math.round(((laatste.reps - eerste.reps) / eerste.reps) * 100)
        trendRegels.push(`${naam}: ${eerste.reps} → ${laatste.reps} reps (${pct > 0 ? '+' : ''}${pct}%)`)
      }
    }

    // Compliance
    const herstelAdviezen = coachAdviezen.filter(a => a.actie_type === 'herstel' || a.actie_type === 'rust').length
    const gevolgdeItems = coachCalls.flatMap(c => (c.coach_call_items || []) as Array<{ status: string; rating: number | null }>).filter(i => i.status === 'done')
    const compliancePct = herstelAdviezen > 0 ? Math.round((gevolgdeItems.length / herstelAdviezen) * 100) : null

    // Bouw prompt
    const prompt = `Je bent de persoonlijke coach van ${profile?.first_name || 'de gebruiker'} (niveau: ${profile?.experience_level || 'beginner'}).

Analyseer de volgende trainingsdata van de afgelopen 60 dagen en geef een persoonlijk ontwikkelingsrapport.

TRAININGSDATA:
- Totaal trainingen: ${totaalTrainingen}
- Totale trainingstijd: ${Math.round(totaalMinuten / 60)} uur
- Gemiddelde RPE: ${gemRpe ?? 'onbekend'}/10
- Modules: ${Object.entries(moduleCount).map(([k, v]) => `${k} (${v}×)`).join(', ')}

OEFENING TRENDS:
${trendRegels.length > 0 ? trendRegels.join('\n') : 'Nog geen oefening trends beschikbaar'}

COMPLIANCE:
- Herstel/rust adviezen: ${herstelAdviezen}
- Coach compliance: ${compliancePct !== null ? `${compliancePct}%` : 'onbekend'}

Geef een persoonlijk, motiverend maar eerlijk rapport. Schrijf in het Nederlands. Wees concreet — gebruik de data.

Reageer ALLEEN in dit JSON formaat:
{
  "kracht": "2-3 zinnen over krachtprogressie",
  "conditie": "2-3 zinnen over conditie/uithoudingsvermogen",
  "herstel": "2-3 zinnen over herstelgedrag en patronen",
  "compliance": "2-3 zinnen over coach compliance en gedrag",
  "risicos": "2-3 zinnen over risico's of aandachtspunten",
  "focus": "2-3 zinnen over aanbevolen focus komende weken",
  "samenvatting": "1 krachtige zin die de kern van de ontwikkeling samenvat"
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''

    let analysis: ProgressAnalysis = {
      kracht: 'Nog onvoldoende data voor een krachtanalyse.',
      conditie: 'Nog onvoldoende data voor een conditie-analyse.',
      herstel: 'Nog onvoldoende data voor een herstelanalyse.',
      compliance: 'Nog onvoldoende data voor een compliance-analyse.',
      risicos: 'Geen specifieke risico\'s gedetecteerd.',
      focus: 'Blijf consistent trainen en volg het coach advies.',
      samenvatting: 'Goed bezig — blijf consistent.',
      generated_at: new Date().toISOString(),
    }

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        analysis = { ...analysis, ...parsed, generated_at: new Date().toISOString() }
      }
    } catch { /* gebruik fallback */ }

    const { data: saved } = await supabase
      .from('progress_analyses')
      .insert({
        user_id: user.id,
        period_days: 60,
        analysis,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    return NextResponse.json(saved || { analysis, generated_at: new Date().toISOString() })
  } catch (err) {
    console.error('[progress-analysis]', err)
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 })
  }
}
