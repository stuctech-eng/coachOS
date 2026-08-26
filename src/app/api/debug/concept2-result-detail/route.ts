// ── Concept2 result-detail — validatie, GEEN productiecode ──────────────
// v2.4.372. Bron: master plan "Activity Bridge Audit + Roeiprestaties",
// vervolgvraag na de Intervals.icu-validatie (25 augustus 2026): we
// weten dat Intervals.icu intervalstructuur teruggeeft, maar dat bewijst
// niets over Concept2's EIGEN API — de primaire bron. Dit moet
// rechtstreeks onderzocht worden vóór concept2-result-processor.ts
// wordt aangepast.
//
// GEEN schrijfacties, GEEN opslag in activity_sessions, GEEN aanroep
// van de OAuth-refresh-flow (die schrijft terug naar concept2_tokens —
// bewust vermeden, puur leesrecht nodig). Als het token verlopen is,
// meldt deze route dat expliciet — draai dan eerst "Sync nu" op de
// Rowing Coach-pagina (die ververst het token wél) en probeer daarna
// opnieuw.
//
// Bevestigd via de officiële documentatie (log.concept2.com/developers/
// documentation, 25 augustus 2026, niet uit geheugen):
//   GET /api/users/{user}/results/{result_id}
//   GET /api/users/{user}/results/{result_id}?include=strokes
//   GET /api/users/{user}/results/{result_id}/strokes  (apart endpoint)
// Het volledige result-schema kan een `workout`-object bevatten met
// `splits`/`intervals` — of dat ook zo terugkomt op DEZE gebruikers
// data is nog niet bevestigd, vandaar deze route.

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

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const resultId = url.searchParams.get('result_id')
    if (!resultId) {
      return NextResponse.json({
        status: 'geen_result_id',
        melding: 'Geef ?result_id=<Concept2-resultaat-ID> mee. Dit vind je in activity_sessions.notes '
          + '(formaat "concept2:119856852" — het getal erachter is het result_id) voor een sessie met intervaltraining.',
      }, { status: 200 })
    }
    // v2.4.372: ?strokes=true is bewust opt-in — het losse strokes-
    // endpoint kan bij lange sessies een zeer grote respons geven
    // (één rij per roeislag). Standaard uit.
    const metStrokes = url.searchParams.get('strokes') === 'true'

    const supabase = createAdminClient()
    const { data: tokenRij } = await supabase
      .from('concept2_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!tokenRij) {
      return NextResponse.json({ status: 'geen_koppeling', melding: 'Geen Concept2-koppeling gevonden voor deze gebruiker.' }, { status: 200 })
    }

    const verlopen = new Date(tokenRij.expires_at).getTime() <= Date.now()
    const authHeader = `Bearer ${tokenRij.access_token}`
    const headers = { Authorization: authHeader, Accept: 'application/vnd.c2logbook.v1+json' }

    const detailUrl = `https://log.concept2.com/api/users/me/results/${resultId}${metStrokes ? '?include=strokes' : ''}`
    const detailRes = await fetch(detailUrl, { headers })
    const detailStatus = detailRes.status
    const detailJson = detailRes.ok ? await detailRes.json() : await detailRes.text().catch(() => null)

    if (!detailRes.ok) {
      return NextResponse.json({
        status: 'api_fout',
        httpStatus: detailStatus,
        tokenMogelijkVerlopen: verlopen,
        melding: verlopen
          ? 'Token is verlopen — draai eerst "Sync nu" op de Rowing Coach-pagina (ververst het token), probeer daarna deze route opnieuw.'
          : 'Onverwachte fout van Concept2.',
        ruweResponse: typeof detailJson === 'string' ? detailJson.slice(0, 500) : detailJson,
      }, { status: 200 })
    }

    const resultData = (detailJson as { data?: Record<string, unknown> })?.data || null

    return NextResponse.json({
      status: 'ok',
      resultId,
      // Kernvraag 1-4: heeft dit resultaat een workout-object met
      // splits/intervallen? Puur tonen, geen interpretatie hier.
      heeftWorkoutObject: !!(resultData && 'workout' in resultData),
      workoutRuw: resultData?.workout ?? null,
      // Kernvraag: bevat het resultaat verder alle relevante velden?
      samenvatting: resultData ? {
        id: resultData.id,
        date: resultData.date,
        distance: resultData.distance,
        time: resultData.time,
        stroke_rate: (resultData as Record<string, unknown>).stroke_rate,
        heart_rate: (resultData as Record<string, unknown>).heart_rate,
        workout_type: resultData.workout_type,
      } : null,
      // Kernvraag 5: is voor stroke-data een APARTE aanroep nodig, of
      // zit het al mee via ?include=strokes? metStrokes=false laat
      // zien of 'strokes' al in de normale respons zit zonder de flag.
      strokesOpgevraagdViaInclude: metStrokes,
      heeftStrokesInDezeRespons: !!(resultData && 'strokes' in resultData),
      // Volledige, ruwe respons — voor handmatige inspectie van alles
      // wat de kernvragen niet expliciet dekken.
      volledigeRuweRespons: detailJson,
    })
  } catch (err) {
    return NextResponse.json({ status: 'onverwachte_fout', melding: String(err) }, { status: 200 })
  }
}
