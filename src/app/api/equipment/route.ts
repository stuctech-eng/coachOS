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

export interface EquipmentProfile {
  kettlebell_available: boolean
  concept2_available: boolean
  cycling_available: boolean
  running_available: boolean
  dumbbell_available: boolean
  barbell_available: boolean
  ab_wheel_available: boolean
  bodyweight_available: boolean
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('profiles')
      .select('kettlebell_available, concept2_available, cycling_available, running_available, dumbbell_available, barbell_available, ab_wheel_available, bodyweight_available')
      .eq('user_id', user.id)
      .single()

    // Defaults als kolommen nog niet bestaan
    const equipment: EquipmentProfile = {
      kettlebell_available: data?.kettlebell_available ?? true,
      concept2_available: data?.concept2_available ?? false,
      cycling_available: data?.cycling_available ?? false,
      running_available: data?.running_available ?? false,
      dumbbell_available: data?.dumbbell_available ?? false,
      barbell_available: data?.barbell_available ?? false,
      ab_wheel_available: data?.ab_wheel_available ?? false,
      bodyweight_available: true, // altijd beschikbaar
    }

    return NextResponse.json(equipment)
  } catch (err) {
    console.error('[equipment GET]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body: Partial<EquipmentProfile> = await req.json()
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('profiles')
      .update({
        kettlebell_available: body.kettlebell_available ?? true,
        concept2_available: body.concept2_available ?? false,
        cycling_available: body.cycling_available ?? false,
        running_available: body.running_available ?? false,
        dumbbell_available: body.dumbbell_available ?? false,
        barbell_available: body.barbell_available ?? false,
        ab_wheel_available: body.ab_wheel_available ?? false,
        bodyweight_available: true,
      })
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[equipment POST]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
