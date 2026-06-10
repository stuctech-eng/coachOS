export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
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

// GET — haal entries op (vandaag of laatste 7 dagen)
export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { searchParams } = new URL(req.url)
    const dagen = parseInt(searchParams.get('dagen') || '1')

    const vanaf = new Date()
    vanaf.setDate(vanaf.getDate() - dagen)

    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', vanaf.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ entries: data || [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[journal GET]', msg)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// POST — nieuwe entry opslaan
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const { energy, stress, motivation, note } = body

    if (!energy && !stress && !motivation && !note) {
      return NextResponse.json({ error: 'Minimaal één veld vereist' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        energy: energy || null,
        stress: stress || null,
        motivation: motivation || null,
        note: note || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ entry: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[journal POST]', msg)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
