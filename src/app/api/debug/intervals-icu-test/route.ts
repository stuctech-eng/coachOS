// ── Intervals.icu — Fase 9: Proof of Data ───────────────────────────────
// v2.4.333. Master plan: "Intervals.icu → CoachOS Data Bridge v1.0",
// vastgesteld 21 augustus 2026 (gebruiker + GPT-overleg).
//
// DIT IS GEEN PRODUCTIECODE. Puur onderzoek — haalt de ruwe, onbewerkte
// activiteitendata op zodat we handmatig kunnen vergelijken met de
// oorspronkelijke Concept2/ErgData-data (§4 van het master plan).
//
// GEEN schrijfacties, GEEN opslag in CoachOS' eigen tabellen, GEEN
// koppeling aan de Activity Bridge — dat komt pas in latere fases,
// ná deze validatie.
//
// API-sleutel/atleet-ID: uitsluitend server-side via omgevingsvariabelen
// (INTERVALS_ICU_API_KEY, INTERVALS_ICU_ATHLETE_ID) — nooit in code,
// nooit naar de client gestuurd, ook niet in dit debug-antwoord.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const INTERVALS_BASE_URL = 'https://intervals.icu/api/v1'

export async function GET() {
  const apiKey = process.env.INTERVALS_ICU_API_KEY
  const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID

  if (!apiKey || !athleteId) {
    return NextResponse.json({
      status: 'niet_geconfigureerd',
      melding: 'INTERVALS_ICU_API_KEY en/of INTERVALS_ICU_ATHLETE_ID ontbreken als omgevingsvariabele in Vercel.',
      apiKeyAanwezig: !!apiKey,
      athleteIdAanwezig: !!athleteId,
    }, { status: 200 })
  }

  // Basic auth: gebruikersnaam is letterlijk "API_KEY", wachtwoord is
  // de daadwerkelijke sleutel — bevestigd uit Intervals.icu's eigen
  // documentatie/forum, niet zelf verzonnen.
  const authHeader = 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64')

  try {
    // Laatste 90 dagen — ruim genoeg om minstens één Concept2/roei-
    // activiteit te vinden, zonder de volledige historie op te vragen
    // (§12 van het master plan: geen onnodige volledige-historie-call)
    const negentigDagenGeleden = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const vandaag = new Date().toISOString().split('T')[0]

    const res = await fetch(
      `${INTERVALS_BASE_URL}/athlete/${athleteId}/activities?oldest=${negentigDagenGeleden}&newest=${vandaag}`,
      { headers: { Authorization: authHeader } }
    )

    if (!res.ok) {
      const tekst = await res.text().catch(() => '')
      return NextResponse.json({
        status: 'api_fout',
        httpStatus: res.status,
        melding: res.status === 401
          ? 'Authenticatie mislukt — controleer of de sleutel correct in Vercel staat.'
          : 'Onverwachte fout van Intervals.icu.',
        ruweResponse: tekst.slice(0, 500),
      }, { status: 200 })
    }

    const activiteiten = await res.json()

    // Filter op mogelijke roei-activiteiten — Intervals.icu gebruikt
    // vermoedelijk 'Row' of 'Rowing' als type, nog te bevestigen met
    // echte data, geen aanname hardcoded in productiecode.
    const roeiActiviteiten = Array.isArray(activiteiten)
      ? activiteiten.filter((a: { type?: string }) =>
          a.type && /row/i.test(a.type))
      : []

    // v2.4.335: gemeld — echte trainingsstructuur van de 21-8-sessie
    // (5 min warmup, 42 min hoofdblok — halverwege gestopt, 3 min
    // cooldown) om te vergelijken met wat Intervals.icu daadwerkelijk
    // aan intervaldetails teruggeeft. interval_summary was in de
    // basis-aanroep hierboven altijd null — dat vergt een aparte
    // aanroep met ?intervals=true, bevestigd uit de API-documentatie.
    let intervalDetailEersteSessie = null
    if (roeiActiviteiten[0]) {
      const eersteId = (roeiActiviteiten[0] as { id: string }).id
      const intervalRes = await fetch(
        `${INTERVALS_BASE_URL}/activity/${eersteId}?intervals=true`,
        { headers: { Authorization: authHeader } }
      )
      if (intervalRes.ok) {
        intervalDetailEersteSessie = await intervalRes.json()
      } else {
        intervalDetailEersteSessie = { fout: `HTTP ${intervalRes.status} bij het ophalen van intervaldetails` }
      }
    }

    return NextResponse.json({
      status: 'ok',
      totaalActiviteiten: Array.isArray(activiteiten) ? activiteiten.length : 0,
      alleGevondenTypes: Array.isArray(activiteiten)
        ? [...new Set(activiteiten.map((a: { type?: string }) => a.type))]
        : [],
      roeiActiviteitenGevonden: roeiActiviteiten.length,
      // v2.4.334: samenvatting per sessie — gevraagd om te checken of
      // het ontbreken van hartslag in de eerste test incidenteel was
      // (geen band die dag) of structureel (komt sowieso niet mee via
      // Intervals.icu). Bewust GEEN aanname, gewoon per sessie tonen.
      samenvattingPerSessie: roeiActiviteiten.map((a: {
        id: string; start_date_local: string; name: string
        average_heartrate: number | null; has_heartrate: boolean | null
        distance: number; moving_time: number
        average_cadence: number | null; icu_lap_count: number | null
        external_id: string | null; source: string | null
      }) => ({
        id: a.id,
        datum: a.start_date_local,
        naam: a.name,
        heeftHartslag: !!(a.average_heartrate && a.average_heartrate > 0),
        gemHartslag: a.average_heartrate,
        afstandM: a.distance,
        duurSec: a.moving_time,
        slagfrequentie: a.average_cadence,
        laps: a.icu_lap_count,
        externalId: a.external_id,
        bron: a.source,
      })),
      // Volledige, ruwe data van de EERSTE gevonden roei-activiteit —
      // dit is precies wat Fase 9 wil vergelijken met de originele
      // Concept2-data (§4: datum, tijd, duur, afstand, pace, hartslag,
      // power, stroke rate, intervallen, unieke ID).
      eersteRoeiActiviteitRuw: roeiActiviteiten[0] || null,
      // v2.4.335: intervaldetails van de eerste sessie — vergelijk dit
      // met de opgegeven, echte structuur (5 min warmup, 42 min
      // hoofdblok, halverwege gestopt, 3 min cooldown)
      intervalDetailEersteSessie,
    })
  } catch (err) {
    return NextResponse.json({
      status: 'onverwachte_fout',
      melding: String(err),
    }, { status: 200 })
  }
}
