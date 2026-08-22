// ── Intervals.icu — Dry Run (Fase 13 + 14) ──────────────────────────────
// v2.4.337. Master plan §13, letterlijk: "Historische import begint
// altijd als dry-run... Geen automatische mutatie tijdens de eerste
// test." Deze route schrijft NOOIT naar activity_sessions — puur
// analyse en rapportage.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { haalIntervalsConfig, haalIntervalsActiviteiten } from '@/lib/integrations/intervals/client'
import { mapIntervalsActiviteit, type IntervalsActiviteitRuw } from '@/lib/integrations/intervals/mapper'
import { nieuweBronWint } from '@/lib/activity-import/source-priority-policy'

export async function GET(req: Request) {
  const config = haalIntervalsConfig()
  if (!config) {
    return NextResponse.json({ status: 'niet_geconfigureerd' }, { status: 200 })
  }

  // v2.4.337: user_id via query-param — deze dry-run-route is
  // debug-only (net als intervals-icu-test), geen gebruikerssessie
  // vereist zodat we 'm rechtstreeks kunnen aanroepen tijdens Fase 13.
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

    // v2.4.338-FIX: gemeld — roeiActivityIdGevonden gaf false, ondanks
    // dat de gebruiker wel degelijk Roeien-activiteiten heeft. Root
    // cause: deze opzoeking miste de user_id-filter. `activities` is,
    // exact zoals de bestaande Activity Bridge al laat zien
    // (`.insert({ user_id: input.userId, ... })`), PER GEBRUIKER
    // opgeslagen, geen globale tabel — zonder filter kon dit dus nooit
    // betrouwbaar de juiste rij vinden.
    const { data: roeiType } = await supabase.from('activities').select('id').eq('user_id', userId).eq('name', 'Roeien').maybeSingle()

    const resultaten = []
    let nieuwCount = 0, reedsGeimporteerdCount = 0, geblokkeerdCount = 0

    for (const ruw of roeiActiviteiten) {
      const gemapt = mapIntervalsActiviteit(ruw)

      // Check 1: is deze exacte external_id al eerder geïmporteerd?
      // (§9: externe ID is de primaire herkenning, niet alleen datum/duur)
      const { data: reedsAanwezig } = await supabase
        .from('activity_sessions')
        .select('id')
        .eq('user_id', userId)
        .ilike('notes', `%${gemapt.notes}%`)
        .maybeSingle()

      if (reedsAanwezig) {
        reedsGeimporteerdCount++
        resultaten.push({ intervalsId: ruw.id, datum: gemapt.date, status: 'reeds_geimporteerd', bestaandeActivitySessionId: reedsAanwezig.id })
        continue
      }

      // Check 2: bestaat er die dag al een activiteit met gelijke/hogere
      // bronprioriteit? (bestaande nieuweBronWint()-logica hergebruikt,
      // geen nieuw dedup-systeem — §10 van het master plan)
      const { data: bestaandeDieDag } = await supabase
        .from('activity_sessions')
        .select('id, source')
        .eq('user_id', userId)
        .eq('date', gemapt.date)
        .eq('activity_id', roeiType?.id || null)

      const geblokkeerdDoor = (bestaandeDieDag || []).find(rij => !nieuweBronWint('intervals_icu', rij.source))

      if (geblokkeerdDoor) {
        geblokkeerdCount++
        resultaten.push({ intervalsId: ruw.id, datum: gemapt.date, status: 'geblokkeerd_door_bestaande_bron', blokkerendeBron: geblokkeerdDoor.source })
        continue
      }

      nieuwCount++
      resultaten.push({ intervalsId: ruw.id, datum: gemapt.date, status: 'nieuw', gemapteData: gemapt })
    }

    return NextResponse.json({
      status: 'ok',
      // §13, letterlijke vereisten van het rapport:
      aantalGevondenActiviteiten: roeiActiviteiten.length,
      aantalNieuw: nieuwCount,
      aantalReedsGeimporteerd: reedsGeimporteerdCount,
      aantalGeblokkeerd: geblokkeerdCount,
      roeiActivityIdGevonden: !!roeiType,
      resultaten,
      // Herbevestiging: geen enkele insert is uitgevoerd door deze route.
      schrijfactiesUitgevoerd: 0,
    })
  } catch (err) {
    return NextResponse.json({ status: 'onverwachte_fout', melding: String(err) }, { status: 200 })
  }
}
