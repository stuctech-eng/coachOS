export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser'
import { verwerkConnectWorkoutResultaat, type ConnectWorkoutResultInput } from '@/lib/activity-import/connect-result-bridge'

// ── CoachOS Connect — workout-resultaat-upload ───────────────────────────
// Sprint 6b-3 (28 augustus 2026). Native-only endpoint (Bearer-auth via
// getAuthenticatedUser, zelfde helper als api/today en .../workout) —
// de PWA heeft hier geen equivalent voor, dus geen backwards-
// compatibility-risico.
//
// Schrijft naar het BESTAANDE activity_sessions + Source Priority
// Policy-systeem (zie connect-result-bridge.ts) — geen nieuw
// resultaat-systeem, zoals vastgelegd in de architectuurbeslissing.

interface RequestBody {
  sessieId?: string
  startedAt?: string
  completedAt?: string
  device?: { manufacturer?: string; model?: string }
  totals?: ConnectWorkoutResultInput['totals']
  intervals?: ConnectWorkoutResultInput['intervals']
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body: RequestBody = await req.json()

    if (!body.sessieId) return NextResponse.json({ error: 'sessieId ontbreekt' }, { status: 400 })
    if (!body.startedAt || !body.completedAt) return NextResponse.json({ error: 'startedAt/completedAt ontbreekt' }, { status: 400 })
    if (!body.device?.manufacturer || !body.device?.model) return NextResponse.json({ error: 'device ontbreekt' }, { status: 400 })

    const uitkomst = await verwerkConnectWorkoutResultaat({
      userId: user.id,
      sessieId: body.sessieId,
      startedAt: body.startedAt,
      completedAt: body.completedAt,
      device: { manufacturer: body.device.manufacturer, model: body.device.model },
      totals: body.totals,
      intervals: body.intervals,
    })

    if (!uitkomst.aangemaakt && uitkomst.reden.startsWith('insert mislukt')) {
      return NextResponse.json({ error: uitkomst.reden }, { status: 500 })
    }

    // Zowel "aangemaakt" als "al eerder geüpload" (idempotent) en "hogere
    // source-prioriteit wint" geven 200 terug — geen van drie is een
    // fout vanuit Connect's perspectief; Connect's lokale wachtrij mag
    // het item in alle drie de gevallen als "verwerkt" beschouwen.
    return NextResponse.json({ aangemaakt: uitkomst.aangemaakt, reden: uitkomst.reden, activiteitId: uitkomst.activiteitId })
  } catch (err) {
    console.error('[api/specialists/rowing/training-plan/workout-result]', err)
    return NextResponse.json({ error: 'Verwerken van workout-resultaat mislukt' }, { status: 500 })
  }
}
