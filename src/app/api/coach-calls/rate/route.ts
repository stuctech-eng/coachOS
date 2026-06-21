export const dynamic = 'force-dynamic'

// POST — sla rating/mood/notes op voor één of meerdere coach_call_items
// Genereert direct een coach-reactie per item (Niveau 3 — vriendschappelijk)
// Herberekent coach_call.status (pending/partial/completed)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { buildCoachCallReactionPrompt } from '@/core/prompts/coach-call-reaction'

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

interface ItemRating {
  item_id: string
  rating: number
  mood?: number
  notes?: string
}

async function generateCoachReaction(
  item: { sport_type: string; distance_m: number | null; duration_min: number },
  rating: number,
  mood: number,
  notes: string | null,
  completedCoachCalls: number,
  ignoredAdvice: boolean
): Promise<{ coach_reactie: string; belasting: string; emotie: string } | null> {
  try {
    const systemPrompt = buildCoachCallReactionPrompt({
      sportType: item.sport_type,
      distanceM: item.distance_m,
      durationMin: item.duration_min,
      rating,
      mood,
      notes,
      ignoredAdvice,
      completedCoachCalls,
    })

    // Directe Anthropic API call — geen /api/ai proxy
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Reageer op deze training.' }],
      }),
    })

    const aiData = await aiResponse.json()
    const rawText = aiData.content?.[0]?.text || ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.coach_reactie) return null

    return {
      coach_reactie: parsed.coach_reactie,
      belasting: parsed.belasting || 'gemiddeld',
      emotie: parsed.emotie || 'neutraal',
    }
  } catch (err) {
    console.error('[coach-call-reaction]', err)
    return null
  }
}

// Body: { ratings: [{ item_id, rating, mood?, notes? }], coach_call_id }
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { ratings, coach_call_id } = await req.json() as {
      ratings: ItemRating[]
      coach_call_id: string
    }

    if (!ratings?.length || !coach_call_id) {
      return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Valideer dat coach_call van deze user is
    const { data: call } = await supabase
      .from('coach_calls')
      .select('id')
      .eq('id', coach_call_id)
      .eq('user_id', user.id)
      .single()

    if (!call) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    // Aantal eerder voltooide coach calls — bepaalt of plagerige humor mag
    const { count: completedCoachCalls } = await supabase
      .from('coach_calls')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')

    // Was er vandaag een rust/herstel-advies dat genegeerd is?
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const { data: recommendation } = await supabase
      .from('coach_recommendations')
      .select('actie_type')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('type', 'coach')
      .single()
    const ignoredAdvice = recommendation?.actie_type === 'rust' || recommendation?.actie_type === 'herstel'

    const reactions: Record<string, { coach_reactie: string; belasting: string; emotie: string } | null> = {}

    // Update elk item — sequentieel, elk item krijgt zijn eigen AI-reactie
    for (const { item_id, rating, mood, notes } of ratings) {
      const { data: item } = await supabase
        .from('coach_call_items')
        .select('sport_type, distance_m, duration_min')
        .eq('id', item_id)
        .eq('coach_call_id', coach_call_id)
        .single()

      let coachResponse: string | null = null

      if (item && mood) {
        const reaction = await generateCoachReaction(
          item, rating, mood, notes || null,
          completedCoachCalls || 0, ignoredAdvice
        )
        if (reaction) {
          coachResponse = reaction.coach_reactie
          reactions[item_id] = reaction
        }
      }

      await supabase.from('coach_call_items')
        .update({
          rating,
          mood: mood ?? null,
          notes: notes || null,
          coach_response: coachResponse,
          status: 'done',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item_id)
        .eq('coach_call_id', coach_call_id)
    }

    // Herbereken call status (status-machine)
    const { data: allItems } = await supabase
      .from('coach_call_items')
      .select('status')
      .eq('coach_call_id', coach_call_id)

    const total = allItems?.length || 0
    const done = allItems?.filter(i => i.status === 'done').length || 0

    let newStatus: string
    let completedAt: string | null = null
    if (done === 0) newStatus = 'pending'
    else if (done < total) newStatus = 'partial'
    else { newStatus = 'completed'; completedAt = new Date().toISOString() }

    await supabase.from('coach_calls').update({
      status: newStatus,
      ...(completedAt ? { completed_at: completedAt } : {}),
    }).eq('id', coach_call_id)

    return NextResponse.json({ status: newStatus, done, total, reactions })
  } catch (err) {
    console.error('[coach-calls/rate]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
