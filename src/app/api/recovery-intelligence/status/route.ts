// ── Recovery Intelligence — Status-route voor het Debug Panel ──────────
// v2.4.329. Puur lezend, geen enkele bijwerking. Hergebruikt de
// bestaande config/baseline-modules — geen nieuwe berekening.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { haalActieveRiConfig } from '@/lib/recovery-intelligence/config'

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
    const configResultaat = await haalActieveRiConfig(supabase)

    const [{ data: laatsteRun }, { data: baselines }, { data: recenteLoadDagen }, { data: patronen }] = await Promise.all([
      supabase.from('ri_analysis_runs').select('status, started_at, completed_at, data_through_date, error')
        .eq('user_id', user.id).order('started_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('ri_baselines').select('metric, baseline_value, baseline_stddev, sample_count')
        .eq('user_id', user.id).is('valid_until', null).order('metric'),
      supabase.from('ri_load_proxy_view').select('date')
        .eq('user_id', user.id)
        .gte('date', new Date(Date.now() - (configResultaat?.config.baseline_window_days ?? 30) * 86400000).toISOString().split('T')[0]),
      supabase.from('ri_patterns').select('pattern_type, description, confidence_tier, occurrence_count, status')
        .eq('user_id', user.id).order('last_confirmed_at', { ascending: false }),
    ])

    const minDagen = configResultaat?.config.min_baseline_days ?? 10
    const huidigeLoadDagen = (recenteLoadDagen || []).length

    return NextResponse.json({
      enabled: configResultaat?.config.enabled ?? null,
      algorithm_version: configResultaat?.version ?? null,
      laatste_analyse: laatsteRun || null,
      baselines: baselines || [],
      load_baseline_voortgang: `${huidigeLoadDagen}/${minDagen} dagen binnen het venster`,
      load_baseline_klaar: huidigeLoadDagen >= minDagen,
      patronen: patronen || [],
      patronen_aantal: (patronen || []).length,
    })
  } catch (err) {
    console.error('[recovery-intelligence status]', err)
    return NextResponse.json({ error: 'Status ophalen mislukt' }, { status: 500 })
  }
}
