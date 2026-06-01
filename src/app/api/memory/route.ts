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

    // Haal laatste 30 dagen check-ins op
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })

    if (!checkins || checkins.length < 3) {
      return NextResponse.json({ message: 'Nog te weinig data voor inzichten' })
    }

    // Haal bestaande memory op
    const { data: existingMemory } = await supabase
      .from('coach_memory')
      .select('content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Bouw analyse prompt
    const checkinSummary = checkins.map(c =>
      'Datum: ' + c.date +
      ', Gevoel: ' + c.feeling_score +
      ', Energie: ' + c.energy_score +
      ', Pijn: ' + (c.has_pain ? 'ja' : 'nee') +
      (c.pain_description ? ' (' + c.pain_description + ')' : '') +
      (c.notes ? ', Notitie: ' + c.notes : '')
    ).join('\n')

    const existingMemorySummary = existingMemory && existingMemory.length > 0
      ? existingMemory.map(m => '- ' + m.content).join('\n')
      : 'Geen bestaande inzichten'

    const systemPrompt = 'Je bent een AI coach die patronen analyseert in gezondheidsdata.\n\n' +
      'Analyseer deze check-in data van de laatste 30 dagen en genereer maximaal 3 nieuwe inzichten.\n\n' +
      'CHECK-IN DATA:\n' + checkinSummary + '\n\n' +
      'BESTAANDE INZICHTEN:\n' + existingMemorySummary + '\n\n' +
      'Regels:\n' +
      '- Genereer alleen NIEUWE inzichten die nog niet in de bestaande inzichten staan\n' +
      '- Minimaal 5 check-ins nodig voor een betrouwbaar patroon\n' +
      '- Wees specifiek en concreet\n' +
      '- Geen voor de hand liggende conclusies\n\n' +
      'Reageer ALLEEN in dit JSON formaat:\n' +
      '{\n' +
      '  "insights": [\n' +
      '    { "content": "Inzicht beschrijving", "confidence": 75, "type": "pattern" },\n' +
      '    { "content": "Inzicht beschrijving", "confidence": 82, "type": "warning" }\n' +
      '  ]\n' +
      '}\n\n' +
      'Types: pattern / warning / achievement / preference\n' +
      'Confidence: 0-100\n' +
      'Geef lege array als er geen nieuwe inzichten zijn.'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coach-os-tau.vercel.app'
    const aiResponse = await fetch(appUrl + '/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Analyseer de check-in data en genereer inzichten.' }],
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
      return NextResponse.json({ message: 'Geen nieuwe inzichten' })
    }

    if (insights.length === 0) {
      return NextResponse.json({ message: 'Geen nieuwe inzichten gevonden' })
    }

    // Sla nieuwe inzichten op
    const memoryItems = insights.map(insight => ({
      user_id: user.id,
      memory_type: insight.type || 'pattern',
      content: insight.content,
      confidence: insight.confidence,
    }))

    await supabase.from('coach_memory').insert(memoryItems)

    // Sla ook op als knowledge observations
    const observations = insights.map(insight => ({
      user_id: user.id,
      observation: insight.content,
      confidence: insight.confidence,
      source: 'checkin_analysis',
    }))

    await supabase.from('knowledge_observations').insert(observations)

    return NextResponse.json({
      message: insights.length + ' nieuwe inzichten opgeslagen',
      insights: insights.length,
    })

  } catch (error) {
    console.error('Memory API error:', error)
    return NextResponse.json({ error: 'Memory analyse mislukt' }, { status: 500 })
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
