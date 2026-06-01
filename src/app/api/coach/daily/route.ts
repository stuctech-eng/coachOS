import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { coachEngine } from '@/core/ai-engine/coach-engine'

export async function POST() {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const recommendation = await coachEngine.generateDailyAdvice(user.id)
    return NextResponse.json(recommendation)
  } catch (error) {
    console.error('Coach generation error:', error)
    return NextResponse.json({ error: 'Coach generatie mislukt' }, { status: 500 })
  }
}
