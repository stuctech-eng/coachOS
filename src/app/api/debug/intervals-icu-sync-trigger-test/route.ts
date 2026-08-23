// ── Intervals.icu — Test: activities-sync-trigger ───────────────────────
// v2.4.364. Gemeld: "pull werkt niet, icu moet pushen, icu webversie
// moet actief zijn." Bevestigd via een Intervals.icu-forumpost
// (november 2025, ook bij Oura/Coros): activiteiten van externe
// bronnen worden pas beschikbaar ná een bezoek aan de website zelf —
// dat bezoek triggert kennelijk `POST /api/athlete/{id}/activities-sync`
// (LET OP: geen /api/v1/-voorvoegsel, dit is een ander, intern-ogend
// endpoint dan de rest van de API die we al gebruiken).
//
// Dit bestand test ALLEEN of dit endpoint reageert op onze bestaande,
// publieke API-sleutel (Basic Auth) — de forumpost liet dit onduidelijk
// (mogelijk vergt het een sessie-cookie i.p.v. een API-sleutel, wat
// zou verklaren waarom dit niet publiek gedocumenteerd is). Geen
// productiecode, geen wijziging aan de bestaande, werkende import.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { haalIntervalsConfig } from '@/lib/integrations/intervals/client'

export async function GET() {
  const config = haalIntervalsConfig()
  if (!config) {
    return NextResponse.json({ status: 'niet_geconfigureerd' }, { status: 200 })
  }

  const authHeader = 'Basic ' + Buffer.from(`API_KEY:${config.apiKey}`).toString('base64')

  try {
    const res = await fetch(
      `https://intervals.icu/api/athlete/${config.athleteId}/activities-sync`,
      { method: 'POST', headers: { Authorization: authHeader } }
    )

    const tekst = await res.text().catch(() => '')

    return NextResponse.json({
      status: 'ok',
      httpStatus: res.status,
      werktMetApiSleutel: res.ok,
      ruweResponse: tekst.slice(0, 500),
    })
  } catch (err) {
    return NextResponse.json({ status: 'onverwachte_fout', melding: String(err) }, { status: 200 })
  }
}
