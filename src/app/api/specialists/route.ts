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

// ── Fase 1 — Specialist Registry ────────────────────────────────────────
// Bron: docs/specialist-coaches.md §5, docs/specialist-api.md Fase 1.
// Puur beheer: geen AI, geen berekeningen. Vaste code-config hieronder
// bepaalt WELKE specialisten kunnen bestaan; specialist_profiles (SQL
// v2.4.59) bepaalt WELKE daarvan actief zijn voor DEZE gebruiker.
//
// Referentie-implementatie: alleen 'cycling' heeft status 'active' —
// de rest staat op 'development' totdat ze daadwerkelijk gebouwd zijn.
// Bewust geen overclaiming: een specialist die nog niet bestaat, mag
// niet activeerbaar lijken.
const SPECIALIST_CONFIG: Record<string, { label: string; status: 'active' | 'development' }> = {
  cycling:  { label: 'Cycling Coach',  status: 'active' },
  running:  { label: 'Running Coach',  status: 'development' },
  rowing:   { label: 'Rowing Coach',   status: 'development' },
  strength: { label: 'Strength Coach', status: 'development' },
}

// GET — lijst specialisten voor deze gebruiker: welke zijn actief,
// welke zijn beschikbaar-maar-niet-actief, welke zijn nog in ontwikkeling
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: profielen, error } = await supabase
      .from('specialist_profiles')
      .select('specialist_type, active, activated_at, preferences')
      .eq('user_id', user.id)

    if (error) throw error

    const profielMap = new Map((profielen || []).map(p => [p.specialist_type, p]))

    const specialisten = Object.entries(SPECIALIST_CONFIG).map(([type, config]) => {
      const profiel = profielMap.get(type)
      return {
        specialist_type: type,
        label: config.label,
        beschikbaar: config.status === 'active',
        actief: profiel?.active ?? false,
        activated_at: profiel?.activated_at ?? null,
      }
    })

    return NextResponse.json({ specialisten })
  } catch (err) {
    console.error('[specialists GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

// POST — activeer/deactiveer een specialist. Body: { specialist_type, active }
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const { specialist_type, active } = body

    if (typeof specialist_type !== 'string' || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'specialist_type (string) en active (boolean) zijn verplicht' }, { status: 400 })
    }

    const config = SPECIALIST_CONFIG[specialist_type]
    if (!config) {
      return NextResponse.json({ error: `Onbekende specialist_type: ${specialist_type}` }, { status: 400 })
    }
    if (active && config.status !== 'active') {
      return NextResponse.json({ error: `${config.label} is nog in ontwikkeling, kan nog niet geactiveerd worden` }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Upsert — gebruikt de unieke constraint (user_id, specialist_type)
    // uit specialist_profiles (SQL v2.4.59). activated_at wordt alleen
    // bijgewerkt bij het activeren, niet bij deactiveren (historisch
    // referentiepunt blijft behouden).
    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      specialist_type,
      active,
    }
    if (active) upsertData.activated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('specialist_profiles')
      .upsert(upsertData, { onConflict: 'user_id,specialist_type' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, profiel: data })
  } catch (err) {
    console.error('[specialists POST]', err)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }
}
