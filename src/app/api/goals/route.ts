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

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
    return NextResponse.json({ goals: data || [] })
  } catch (error) {
    console.error('Goals GET error:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.title) return NextResponse.json({ error: 'Titel verplicht' }, { status: 400 })
    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('user_goals')
      .select('priority')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(1)
    const priority = ((existing?.[0]?.priority || 0) + 1)

    // v2.4.87: Goal Engine — goal_scope/specialist_type/importance
    // toegevoegd. "importance" is de gebruikerskeuze (stabiel), NIET de
    // urgency-berekening (die is dynamisch, zie goal-engine.ts).
    // Validatie: specialist_type alleen zinvol bij goal_scope='specialist',
    // dwing dat hier af i.p.v. stilzwijgend een inconsistente combinatie
    // toe te staan (bijv. scope='global' met een specialist_type erbij).
    const goalScope = body.goal_scope === 'specialist' ? 'specialist' : 'global'
    const specialistType = goalScope === 'specialist' && typeof body.specialist_type === 'string' ? body.specialist_type : null
    const geldigeImportances = ['must', 'high', 'normal', 'low']
    const importance = geldigeImportances.includes(body.importance) ? body.importance : 'normal'

    if (goalScope === 'specialist' && !specialistType) {
      return NextResponse.json({ error: "specialist_type is verplicht wanneer goal_scope 'specialist' is" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_goals')
      .insert({
        user_id: user.id,
        goal_type: body.goal_type || 'custom',
        title: body.title,
        priority,
        status: 'active',
        target_value: body.target_value || null,
        target_date: body.target_date || null,
        goal_scope: goalScope,
        specialist_type: specialistType,
        importance,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ goal: data })
  } catch (error) {
    console.error('Goals POST error:', error)
    return NextResponse.json({ error: 'Toevoegen mislukt' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'ID verplicht' }, { status: 400 })
    const supabase = createAdminClient()

    const update: Record<string, unknown> = {}
    if (body.status !== undefined)        update.status        = body.status
    if (body.current_value !== undefined) update.current_value = body.current_value
    if (body.target_value !== undefined)  update.target_value  = body.target_value
    if (body.title !== undefined)         update.title         = body.title
    // v2.4.87: Goal Engine-velden ook via PATCH aanpasbaar
    if (body.goal_scope !== undefined)    update.goal_scope    = body.goal_scope === 'specialist' ? 'specialist' : 'global'
    if (body.specialist_type !== undefined) update.specialist_type = body.specialist_type || null
    if (body.importance !== undefined) {
      const geldigeImportances = ['must', 'high', 'normal', 'low']
      update.importance = geldigeImportances.includes(body.importance) ? body.importance : 'normal'
    }

    const { error } = await supabase
      .from('user_goals')
      .update(update)
      .eq('id', body.id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Goals PATCH error:', error)
    return NextResponse.json({ error: 'Updaten mislukt' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID verplicht' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('user_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Goals DELETE error:', error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
