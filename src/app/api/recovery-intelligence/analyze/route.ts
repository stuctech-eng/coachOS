// ── Recovery Intelligence — /api/recovery-intelligence/analyze ─────────
// v2.4.328. LAZY, RATE-LIMITED BACKGROUND ANALYSIS (Fase 7.1, punt 3 —
// bewust GEEN "dagelijkse batch"-claim: als een gebruiker dagen niet
// naar de Coach gaat, gebeurt er dagenlang niets, en dat is voor V1
// een geaccepteerde, expliciet benoemde beperking, geen bug).
//
// Aangeroepen fire-and-forget vanuit api/coach/route.ts, exact hetzelfde
// patroon als de al-bestaande /api/memory-aanroep.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { haalActieveRiConfig } from '@/lib/recovery-intelligence/config'
import { updateBaselines } from '@/lib/recovery-intelligence/baseline'
import { voerPatroonDetectieUit } from '@/lib/recovery-intelligence/pattern-detection'

const RATE_LIMIT_UREN = 24

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId ontbreekt' }, { status: 400 })

    const supabase = createAdminClient()

    const configResultaat = await haalActieveRiConfig(supabase)
    if (!configResultaat || !configResultaat.config.enabled) {
      // Kill switch (Fase 7, punt F) — functioneel alsof RI niet bestaat.
      // Geen enkele query hierna, geen enkel effect.
      return NextResponse.json({ skipped: true, reason: 'disabled' })
    }
    const { version: algorithmVersion, config } = configResultaat

    // Snelheidsrem — Fase 7.1, punt 3
    const { data: laatsteRun } = await supabase
      .from('ri_analysis_runs')
      .select('completed_at')
      .eq('user_id', userId).eq('status', 'completed')
      .order('completed_at', { ascending: false }).limit(1).maybeSingle()

    if (laatsteRun?.completed_at) {
      const urenGeleden = (Date.now() - new Date(laatsteRun.completed_at).getTime()) / (1000 * 60 * 60)
      if (urenGeleden < RATE_LIMIT_UREN) {
        return NextResponse.json({ skipped: true, reason: 'rate_limited' })
      }
    }

    const { data: run, error: runErr } = await supabase
      .from('ri_analysis_runs')
      .insert({ user_id: userId, algorithm_version: algorithmVersion, status: 'running' })
      .select('id').single()

    if (runErr || !run) {
      console.error('[recovery-intelligence] Analysis run aanmaken mislukt:', runErr)
      return NextResponse.json({ error: 'kon analyse niet starten' }, { status: 500 })
    }

    try {
      await updateBaselines(supabase, userId, algorithmVersion, config)
      const resultaat = await voerPatroonDetectieUit(supabase, userId, algorithmVersion, config)

      const vandaag = new Date().toISOString().split('T')[0]
      await supabase.from('ri_analysis_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), data_through_date: vandaag })
        .eq('id', run.id)

      return NextResponse.json({ ok: true, ...resultaat })
    } catch (analyseErr) {
      await supabase.from('ri_analysis_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error: String(analyseErr) })
        .eq('id', run.id)
      console.error('[recovery-intelligence] Analyse mislukt:', analyseErr)
      return NextResponse.json({ error: 'analyse mislukt' }, { status: 500 })
    }
  } catch (err) {
    console.error('[recovery-intelligence] Route-fout:', err)
    return NextResponse.json({ error: 'onverwachte fout' }, { status: 500 })
  }
}
