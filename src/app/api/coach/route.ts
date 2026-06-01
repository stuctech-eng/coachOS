import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { buildDailyCoachPrompt } from '@/core/prompts/daily-coach'

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

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null)
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('coach_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
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
    const today = new Date().toISOString().split('T')[0]

    const { data: cached } = await supabase
      .from('coach_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()
    if (cached?.recommendation) return NextResponse.json(cached)

    const [profileRes, goalsRes, checkinRes, metricsRes, memoryRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_goals').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', today).single(),
      supabase.from('coach_memory').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ])

    const profile = profileRes.data
    if (!profile) return NextResponse.json({ error: 'Profiel niet gevonden' }, { status: 404 })

    const recovery = calculateRecoveryScore(checkinRes.data || null, metricsRes.data || null)

    await supabase.from('daily_status').upsert({
      user_id: user.id, date: today,
      recovery_score: recovery.score,
      energy_score: checkinRes.data?.energy_score ? checkinRes.data.energy_score * 10 : null,
      status_color: recovery.color,
    })

    const systemPrompt = buildDailyCoachPrompt(
      profile,
      goalsRes.data || [],
      checkinRes.data || null,
      metricsRes.data || null,
      recovery,
      memoryRes.data || []
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'

    const aiResponse = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Geef mijn coaching advies voor vandaag.' }],
      }),
    })

    const aiData = await aiResponse.json()
    const rawText = aiData.content?.[0]?.text || ''

    let recommendation = 'Een rustige wandeling van 30 minuten'
    let reasoning = 'Op basis van je herstelstatus is lichte beweging de beste keuze vandaag.'

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.recommendation) recommendation = parsed.recommendation
        if (parsed.reasoning) reasoning = parsed.reasoning
      } else if (rawText.length > 10) {
        reasoning = rawText
      }
    } catch {
      if (rawText.length > 10) reasoning = rawText
    }

    const { data: saved, error: saveError } = await supabase
      .from('coach_recommendations')
      .upsert({
        user_id: user.id, date: today,
        recommendation, reasoning,
        recovery_status: recovery.status,
        energy_level: checkinRes.data?.energy_score || 5,
      })
      .select().single()

    if (saveError) throw saveError

    await supabase.from('ai_conversations').insert({
      user_id: user.id, role: 'assistant', message: recommendation,
    })

    // Trigger memory analyse op de achtergrond
    fetch(appUrl + '/api/memory', {
      method: 'POST',
      headers: { 'Cookie': '' },
    }).catch(() => {})

    return NextResponse.json(saved)
  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: 'Coach generatie mislukt' }, { status: 500 })
  }
}
