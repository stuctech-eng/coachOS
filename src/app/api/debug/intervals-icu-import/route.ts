// ── Intervals.icu — Beperkte Productie-Import (Fase 15) ────────────────
// v2.4.339. Master plan §15: "Alleen gevalideerde activiteiten opslaan."
//
// LET OP — dit is de EERSTE route die daadwerkelijk naar
// activity_sessions schrijft. Hergebruikt exact dezelfde client/mapper/
// dedup-logica als de bewezen dry-run (intervals-icu-dry-run/route.ts)
// — geen nieuwe, ongeteste logica hier, alleen de insert zelf toegevoegd.
//
// Schrijft UITSLUITEND activiteiten die als 'nieuw' geclassificeerd
// worden — 'reeds_geimporteerd' en 'geblokkeerd_door_bestaande_bron'
// worden overgeslagen, nooit overschreven (§10: bestaande bronprioriteit
// blijft leidend).

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { haalIntervalsConfig, haalIntervalsActiviteiten } from '@/lib/integrations/intervals/client'
import { mapIntervalsActiviteit, type IntervalsActiviteitRuw } from '@/lib/integrations/intervals/mapper'
import { nieuweBronWint } from '@/lib/activity-import/source-priority-policy'

export async function POST(req: Request) {
  const config = haalIntervalsConfig()
  if (!config) {
    return NextResponse.json({ status: 'niet_geconfigureerd' }, { status: 200 })
  }

  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ status: 'fout', melding: '?user_id=<uuid> vereist' }, { status: 200 })
  }

  try {
    const supabase = createAdminClient()
    const negentigDagenGeleden = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const vandaag = new Date().toISOString().split('T')[0]

    const activiteiten = await haalIntervalsActiviteiten(config, negentigDagenGeleden, vandaag)
    const roeiActiviteiten = (Array.isArray(activiteiten) ? activiteiten : [])
      .filter((a: { type?: string }) => a.type && /row/i.test(a.type)) as IntervalsActiviteitRuw[]

    const { data: roeiType } = await supabase.from('activities').select('id').eq('user_id', userId).eq('name', 'Roeien').maybeSingle()

    if (!roeiType) {
      return NextResponse.json({
        status: 'fout',
        melding: 'Geen "Roeien"-activiteit gevonden voor deze gebruiker — import gestopt, geen enkele schrijfactie uitgevoerd.',
      }, { status: 200 })
    }

    const resultaten = []
    let geimporteerdCount = 0, overgeslagenCount = 0, foutCount = 0

    for (const ruw of roeiActiviteiten) {
      const gemapt = mapIntervalsActiviteit(ruw)

      // Zelfde dedup-checks als de dry-run — exact hergebruikt, geen
      // aparte, mogelijk-afwijkende logica hier.
      const { data: reedsAanwezig } = await supabase
        .from('activity_sessions')
        .select('id')
        .eq('user_id', userId)
        .ilike('notes', `%${gemapt.notes}%`)
        .maybeSingle()

      if (reedsAanwezig) {
        overgeslagenCount++
        resultaten.push({ intervalsId: ruw.id, datum: gemapt.date, status: 'overgeslagen_reeds_geimporteerd' })
        continue
      }

      const { data: bestaandeDieDag } = await supabase
        .from('activity_sessions')
        .select('id, source')
        .eq('user_id', userId)
        .eq('date', gemapt.date)
        .eq('activity_id', roeiType.id)

      const geblokkeerdDoor = (bestaandeDieDag || []).find(rij => !nieuweBronWint('intervals_icu', rij.source))

      if (geblokkeerdDoor) {
        overgeslagenCount++
        resultaten.push({ intervalsId: ruw.id, datum: gemapt.date, status: 'overgeslagen_geblokkeerd', blokkerendeBron: geblokkeerdDoor.source })
        continue
      }

      // ── De daadwerkelijke schrijfactie — enige nieuwe stap t.o.v. de dry-run ──
      const { error: insertErr } = await supabase.from('activity_sessions').insert({
        user_id: userId,
        activity_id: roeiType.id,
        date: gemapt.date,
        duration: gemapt.duration,
        metrics: gemapt.metrics,
        source: gemapt.source,
        notes: gemapt.notes,
      })

      if (insertErr) {
        foutCount++
        resultaten.push({ intervalsId: ruw.id, datum: gemapt.date, status: 'fout', melding: insertErr.message })
        continue
      }

      geimporteerdCount++
      resultaten.push({ intervalsId: ruw.id, datum: gemapt.date, status: 'geimporteerd' })
    }

    return NextResponse.json({
      status: 'ok',
      aantalGevondenActiviteiten: roeiActiviteiten.length,
      aantalGeimporteerd: geimporteerdCount,
      aantalOvergeslagen: overgeslagenCount,
      aantalFout: foutCount,
      resultaten,
    })
  } catch (err) {
    return NextResponse.json({ status: 'onverwachte_fout', melding: String(err) }, { status: 200 })
  }
}
