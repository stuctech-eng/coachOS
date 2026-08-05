export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  type Concept2Result,
  haalOfMaakRoeiActiviteit,
  verwerkConcept2Resultaat,
  verwijderConcept2Resultaat,
} from '@/lib/specialists/concept2-result-processor'
import type { GeleerdPatroon } from '@/core/athlete-platform/learned-adjustments'

// ── Concept2-webhook — Activity Import, automatisch i.p.v. handmatig ────
// Bron: docs/workout-completion-platform-adr-v1.md, Addendum (4 augustus
// 2026) + roadmap-punt 1 (5 augustus 2026, "nog te ontwerpen" → nu
// gebouwd). Zelfde verantwoordelijkheid als concept2/sync/route.ts
// ("Sync nu"-knop) — importeert en verwerkt Concept2-resultaten — maar
// getriggerd DOOR Concept2 zelf i.p.v. door de gebruiker.
//
// BEVEILIGING — geen signature-verificatie mogelijk, geverifieerd niet
// aangenomen: Concept2's eigen API-documentatie (log.concept2.com/
// developers/documentation/, Webhook-sectie, volledig doorgelezen)
// beschrijft GEEN signing-header of HMAC-secret — in tegenstelling tot
// bijv. Schlage/FreshBooks. Twee lagen zelf toegevoegd i.p.v. daarop te
// vertrouwen:
//   1. Een geheim pad-segment (CONCEPT2_WEBHOOK_SECRET) — bij een
//      mismatch een 404, niet 401/403, om niet te verklappen dat dit
//      pad bestaat.
//   2. Voor result-added/result-updated: de payload bevat Concept2's
//      EIGEN user_id, opgezocht tegen concept2_tokens.concept2_user_id
//      (v2.4.286, nieuw veld) — een onbekend Concept2 user-id wordt
//      genegeerd, niet verwerkt.
//
// EERLIJKE BEPERKING, niet op te lossen aan onze kant: Concept2's eigen
// result-deleted-payload bevat GEEN user_id (alleen result_id) — de
// documentatie bevestigt dit letterlijk. Voor deletes kan dus niet
// gevalideerd worden tegen een bekende gebruiker vóór het zoeken; de
// lookup gebeurt op notes-patroon binnen source='concept2', wat het
// risico beperkt (alleen bestaande, eerder geïmporteerde Concept2-
// resultaten zijn te raken), maar niet volledig gebruiker-gebonden kan
// worden geverifieerd. Dit is een grens van Concept2's eigen API-
// ontwerp, geen keuze van CoachOS.

interface WebhookPayload {
  data: {
    type: 'result-added' | 'result-updated' | 'result-deleted'
    result?: Concept2Result & { user_id: number }
    result_id?: number
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  if (!process.env.CONCEPT2_WEBHOOK_SECRET || secret !== process.env.CONCEPT2_WEBHOOK_SECRET) {
    // 404, niet 401/403 — bewust geen bevestiging dat dit pad bestaat
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const payload = await request.json().catch(() => null) as WebhookPayload | null
    if (!payload?.data?.type) {
      return NextResponse.json({ error: 'Ongeldige payload' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { type } = payload.data

    if (type === 'result-deleted') {
      if (!payload.data.result_id) return NextResponse.json({ error: 'result_id ontbreekt' }, { status: 400 })
      // Zie module-comment: geen user_id beschikbaar bij deletes, dus
      // geen vooraf-validatie tegen concept2_tokens mogelijk hier.
      // verwijderConcept2Resultaat zoekt zelf op notes-patroon.
      // We kennen de CoachOS user_id hier niet — zoek 'm via de
      // bestaande activity_sessions-rij zelf (die kent 'm al).
      const { data: bestaandeRij } = await supabase
        .from('activity_sessions').select('id, user_id')
        .eq('source', 'concept2')
        .ilike('notes', `%concept2:${payload.data.result_id}%`)
        .maybeSingle()
      if (!bestaandeRij) return NextResponse.json({ verwerkt: false, reden: 'onbekend resultaat' })
      await verwijderConcept2Resultaat(supabase, bestaandeRij.user_id, payload.data.result_id)
      return NextResponse.json({ verwerkt: true, actie: 'verwijderd' })
    }

    // result-added / result-updated
    const resultaat = payload.data.result
    if (!resultaat) return NextResponse.json({ error: 'result ontbreekt' }, { status: 400 })

    const { data: tokenRij } = await supabase
      .from('concept2_tokens').select('user_id')
      .eq('concept2_user_id', resultaat.user_id)
      .maybeSingle()

    if (!tokenRij) {
      // Onbekend Concept2 user-id — negeren, niet verwerken. Kan
      // gebeuren als concept2_user_id nog niet gevuld is voor een
      // oudere koppeling (van vóór v2.4.286) — geen foutmelding naar
      // Concept2 sturen (die zou het anders blijven retryen), gewoon
      // stil negeren.
      console.error('[concept2/webhook] Onbekend Concept2 user_id, genegeerd:', resultaat.user_id)
      return NextResponse.json({ verwerkt: false, reden: 'onbekende gebruiker' })
    }

    const userId = tokenRij.user_id
    const activiteitId = await haalOfMaakRoeiActiviteit(supabase, userId)

    const { data: geleerdePatronenData } = await supabase
      .from('learned_patterns').select('effect_pad, aanpassing_percentage').eq('user_id', userId).eq('sport', 'rowing')
    const geleerdePatronen: GeleerdPatroon[] = geleerdePatronenData || []

    const uitkomst = await verwerkConcept2Resultaat(supabase, userId, activiteitId, resultaat, geleerdePatronen)

    return NextResponse.json({ verwerkt: uitkomst.status === 'geimporteerd', status: uitkomst.status })
  } catch (err) {
    console.error('[concept2/webhook]', err)
    // 200, niet 500 — een 500 zou Concept2 doen retryen; bij een eigen
    // bug heeft retryen geen zin en vervuilt het alleen de logs
    return NextResponse.json({ error: 'Verwerken mislukt' }, { status: 200 })
  }
}
