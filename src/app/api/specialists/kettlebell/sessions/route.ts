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

// ── Kettlebell GS Sessions — MVP1 ───────────────────────────────────────
// Handmatige registratie van Girevoy Sport-sets. Bewust een eigen route
// i.p.v. hergebruik van api/training/complete/route.ts: die laatste
// registreert de bestaande, generieke kettlebell-krachttraining-module
// (sets/reps/gewicht/tempo per oefening) — dit hier is een ander domein
// (timed sets, RPM, discipline, wedstrijdcontext), zie
// docs/kettlebell-specialist-architectuurvoorstel-v1.md §1.5/§3.

const GELDIGE_DISCIPLINES = ['jerk', 'snatch', 'long_cycle', 'biathlon'] as const
type Discipline = typeof GELDIGE_DISCIPLINES[number]

interface NieuweSessieBody {
  discipline: Discipline
  bell_weight_kg: number
  duration_sec: number
  reps: number
  rpm_avg?: number
  hr_avg?: number
  hr_max?: number
  rpe?: number
  technique_score?: number
  no_counts?: number
  federation_id?: string
  notes?: string
  performed_at?: string
}

function valideer(body: NieuweSessieBody): string | null {
  if (!GELDIGE_DISCIPLINES.includes(body.discipline)) return 'Ongeldige discipline'
  if (!(body.bell_weight_kg > 0)) return 'bell_weight_kg moet groter dan 0 zijn'
  if (!(body.duration_sec > 0)) return 'duration_sec moet groter dan 0 zijn'
  if (!(body.reps >= 0)) return 'reps moet 0 of hoger zijn'
  if (body.rpe != null && (body.rpe < 1 || body.rpe > 10)) return 'rpe moet tussen 1 en 10 liggen'
  if (body.technique_score != null && (body.technique_score < 1 || body.technique_score > 5)) return 'technique_score moet tussen 1 en 5 liggen'
  return null
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const limiet = parseInt(url.searchParams.get('limit') || '50', 10)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_gs_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('performed_at', { ascending: false })
      .limit(limiet)

    if (error) throw error
    return NextResponse.json({ sessies: data || [] })
  } catch (err) {
    console.error('[kettlebell/sessions GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as NieuweSessieBody
    const foutmelding = valideer(body)
    if (foutmelding) return NextResponse.json({ error: foutmelding }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_gs_sessions')
      .insert({
        user_id: user.id,
        discipline: body.discipline,
        bell_weight_kg: body.bell_weight_kg,
        duration_sec: body.duration_sec,
        reps: body.reps,
        rpm_avg: body.rpm_avg ?? null,
        hr_avg: body.hr_avg ?? null,
        hr_max: body.hr_max ?? null,
        rpe: body.rpe ?? null,
        technique_score: body.technique_score ?? null,
        no_counts: body.no_counts ?? 0,
        federation_id: body.federation_id ?? null,
        notes: body.notes ?? null,
        performed_at: body.performed_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, sessie: data })
  } catch (err) {
    console.error('[kettlebell/sessions POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
