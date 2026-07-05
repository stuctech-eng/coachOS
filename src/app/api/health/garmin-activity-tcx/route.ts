export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { XMLParser } from 'fast-xml-parser'

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

interface TcxParsed {
  garmin_sport: string | null
  duration_min: number | null
  distance_m: number | null
  calories: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  avg_watts: number | null
  has_gps: boolean
  creator_device: string | null
  start_date: string | null
}

// v2.4.25: sportherkenning uitsluitend gebaseerd op daadwerkelijk onderzoek
// van 5 echte Garmin TCX-exports deze sessie (Running, Walk, Cycling
// buiten, Cycling indoor, Rowing, Cycling Zwift). Bevindingen:
// - Sport="Running" is 100% betrouwbaar → automatisch "Hardlopen"
// - Sport="Biking" geldt voor ZOWEL buiten als indoor (incl. Zwift, die
//   zelfs nep-GPS genereert die op buiten lijkt) → NIET automatisch te
//   onderscheiden, altijd bevestigen
// - Sport="Other" dekt wandelen, roeien, kracht, kettlebell etc. → altijd
//   een keuze nodig, TCX bevat geen onderscheidend kenmerk hiervoor
function bepaalKeuzeNodig(garminSport: string | null): boolean {
  return garminSport !== 'Running'
}

function suggereerType(garminSport: string | null, hasGps: boolean): string {
  if (garminSport === 'Running') return 'Hardlopen'
  if (garminSport === 'Biking') return hasGps ? 'Fietsen (buiten)' : 'Indoor Fietsen'
  // Other: GPS aanwezig is een zwakke aanwijzing voor wandelen (bewezen niet
  // waterdicht, maar een redelijk startpunt dat de gebruiker kan corrigeren)
  return hasGps ? 'Wandelen' : 'Roeien'
}

// v2.4.27 FIX: Next.js staat in route.ts-bestanden alleen specifieke
// exports toe (GET, POST, dynamic, etc.) — een losse geëxporteerde
// constante breekt de build ("not a valid Route export field"). Deze
// constante wordt alleen intern in dit bestand gebruikt, dus geen export
// nodig.
const ACTIVITEIT_OPTIES = ['Hardlopen', 'Fietsen (buiten)', 'Indoor Fietsen', 'Wandelen', 'Roeien', 'Krachttraining', 'Kettlebell', 'Anders']

function parseTcx(xmlText: string): TcxParsed {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(xmlText)

  const tcd = doc.TrainingCenterDatabase
  const activityRaw = tcd?.Activities?.Activity
  const activity = Array.isArray(activityRaw) ? activityRaw[0] : activityRaw

  const garminSport: string | null = activity?.['@_Sport'] ?? null
  const startDate: string | null = activity?.Id ?? null
  const creatorDevice: string | null = activity?.Creator?.Name ?? null

  const lapsRaw = activity?.Lap
  const laps = Array.isArray(lapsRaw) ? lapsRaw : lapsRaw ? [lapsRaw] : []

  let totaalTijdSec = 0
  let totaalAfstand = 0
  let totaalCalorieen = 0
  let maxHr = 0
  const avgHrPerLap: number[] = []

  for (const lap of laps) {
    totaalTijdSec += parseFloat(lap.TotalTimeSeconds || '0')
    totaalAfstand += parseFloat(lap.DistanceMeters || '0')
    totaalCalorieen += parseInt(lap.Calories || '0', 10)
    const lapAvgHr = lap.AverageHeartRateBpm?.Value
    const lapMaxHr = lap.MaximumHeartRateBpm?.Value
    if (lapAvgHr) avgHrPerLap.push(parseInt(lapAvgHr, 10))
    if (lapMaxHr) maxHr = Math.max(maxHr, parseInt(lapMaxHr, 10))
  }

  // Trackpoints doorlopen voor GPS-check, cadans en watts (gemiddelde van
  // alle niet-nul waarden — TCX heeft geen kant-en-klaar lap-gemiddelde
  // voor cadans/watts zoals het dat wel heeft voor hartslag)
  let hasGps = false
  const cadenceValues: number[] = []
  const wattsValues: number[] = []

  // v2.4.25 FIX (na test tegen echte bestanden): fast-xml-parser behoudt de
  // ns3:-prefix OOK op onderliggende veldnamen, niet alleen op de
  // ouder-tag. Watts zit dus onder Extensions['ns3:TPX']['ns3:Watts'], niet
  // Extensions.TPX.Watts. Cadans voor fietsen staat top-level als
  // tp.Cadence (geen prefix); voor hardlopen staat het als RunCadence
  // binnen ns3:TPX — beide worden hier gecombineerd tot één cadans-waarde.
  for (const lap of laps) {
    const trackRaw = lap.Track
    const tracks = Array.isArray(trackRaw) ? trackRaw : trackRaw ? [trackRaw] : []
    for (const track of tracks) {
      const tpRaw = track.Trackpoint
      const trackpoints = Array.isArray(tpRaw) ? tpRaw : tpRaw ? [tpRaw] : []
      for (const tp of trackpoints) {
        if (tp.Position?.LatitudeDegrees !== undefined) hasGps = true
        const tpx = tp.Extensions?.['ns3:TPX']
        const cad = tp.Cadence ?? tpx?.['ns3:RunCadence']
        const watts = tpx?.['ns3:Watts']
        if (cad && parseInt(cad, 10) > 0) cadenceValues.push(parseInt(cad, 10))
        if (watts && parseFloat(watts) > 0) wattsValues.push(parseFloat(watts))
      }
    }
  }

  const gemiddelde = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  return {
    garmin_sport: garminSport,
    duration_min: totaalTijdSec > 0 ? Math.round(totaalTijdSec / 60) : null,
    distance_m: totaalAfstand > 0 ? Math.round(totaalAfstand) : null,
    calories: totaalCalorieen > 0 ? totaalCalorieen : null,
    avg_hr: gemiddelde(avgHrPerLap),
    max_hr: maxHr > 0 ? maxHr : null,
    avg_cadence: gemiddelde(cadenceValues),
    avg_watts: gemiddelde(wattsValues),
    has_gps: hasGps,
    creator_device: creatorDevice,
    start_date: startDate,
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const adminSupabase = createAdminClient()
    const formData = await req.formData()
    const tcxFile = formData.get('tcx') as File | null
    const confirmId = formData.get('confirm_id') as string | null
    const gekozenType = formData.get('activity_type') as string | null

    // ── Confirm flow ─────────────────────────────────────────────────────────
    if (confirmId) {
      const { data: pendingImport } = await adminSupabase
        .from('garmin_activity_imports')
        .select('id, user_id, parsed_data, status')
        .eq('id', confirmId)
        .eq('user_id', user.id)
        .single()

      if (!pendingImport) return NextResponse.json({ error: 'Import niet gevonden' }, { status: 404 })
      if (pendingImport.status === 'confirmed') return NextResponse.json({ error: 'Deze activiteit is al bevestigd' }, { status: 409 })

      const parsed = pendingImport.parsed_data as TcxParsed
      const activityLabel = gekozenType || suggereerType(parsed.garmin_sport, parsed.has_gps)
      const durationMin = parsed.duration_min ?? 0
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

      // v2.4.28 FIX: idempotency-check, ontbrak eerder — hetzelfde TCX-
      // bestand kon zonder enige waarschuwing meerdere keren bevestigd
      // worden, wat telkens een nieuwe activity_sessions-rij + Coach Call
      // opleverde (dubbele trainingsbelasting). Strava-sync had deze check
      // al (via 'strava:ID' in notes), TCX-import miste 'm nog. De TCX
      // `Id`-waarde (starttijd, bv. "2026-07-05T09:46:18.000Z") is uniek
      // per activiteit en dient hier als herkenningssleutel.
      if (parsed.start_date) {
        const { data: bestaandeSessie } = await adminSupabase
          .from('activity_sessions')
          .select('id')
          .eq('user_id', user.id)
          .ilike('notes', '%garmin_tcx_start:' + parsed.start_date + '%')
          .single()

        if (bestaandeSessie) {
          return NextResponse.json({
            error: 'Deze activiteit is al eerder geïmporteerd (zelfde TCX-bestand).',
            already_imported: true,
          }, { status: 409 })
        }
      }

      let { data: userActivity } = await adminSupabase
        .from('activities').select('id').eq('user_id', user.id).eq('name', activityLabel).single()

      if (!userActivity) {
        const { data: template } = await adminSupabase
          .from('activity_templates').select('id').eq('name', activityLabel).single()
        const { data: newActivity } = await adminSupabase
          .from('activities').insert({ user_id: user.id, template_id: template?.id || null, name: activityLabel })
          .select().single()
        userActivity = newActivity
      }

      const metrics: Record<string, unknown> = {}
      if (parsed.distance_m) metrics.distance = parsed.distance_m
      if (parsed.avg_hr) metrics.avg_hr = parsed.avg_hr
      if (parsed.max_hr) metrics.max_hr = parsed.max_hr
      if (parsed.calories) metrics.calories = parsed.calories
      if (parsed.avg_cadence) metrics.avg_cadence = parsed.avg_cadence
      if (parsed.avg_watts) metrics.avg_watts = parsed.avg_watts

      const { data: session, error: sessionError } = await adminSupabase
        .from('activity_sessions')
        .insert({
          user_id: user.id,
          activity_id: userActivity?.id || null,
          date: today,
          duration: durationMin,
          metrics,
          source: 'garmin', // zelfde toegestane waarde als v2.4.24-fix
          notes: 'garmin_tcx_import:' + confirmId + (parsed.start_date ? ' garmin_tcx_start:' + parsed.start_date : ''),
        })
        .select('id').single()

      if (sessionError) throw sessionError

      // Coach Call altijd triggeren — zelfde redenering als v2.4.23/24
      try {
        const { data: existingCall } = await adminSupabase
          .from('coach_calls').select('id, status').eq('user_id', user.id).eq('date', today).single()

        let callId = existingCall?.id
        if (!callId) {
          const { data: newCall } = await adminSupabase
            .from('coach_calls').insert({ user_id: user.id, date: today, status: 'pending' })
            .select('id').single()
          callId = newCall?.id
        }

        if (callId) {
          await adminSupabase.from('coach_call_items').insert({
            coach_call_id: callId,
            activity_session_id: session.id,
            sport_type: activityLabel,
            duration_min: durationMin,
            status: 'pending',
          })
          if (existingCall && (existingCall.status === 'completed' || existingCall.status === 'expired')) {
            await adminSupabase.from('coach_calls').update({ status: 'pending', completed_at: null }).eq('id', callId)
          }
        }
      } catch (coachCallErr) {
        console.error('[garmin-activity-tcx] coach_call aanmaken mislukt:', coachCallErr)
      }

      await adminSupabase.from('garmin_activity_imports')
        .update({ status: 'confirmed', activity_session_id: session.id })
        .eq('id', confirmId)

      return NextResponse.json({ success: true, confirmed: true, activity_session_id: session.id })
    }

    // ── Extract flow ─────────────────────────────────────────────────────────
    if (!tcxFile) return NextResponse.json({ error: 'Geen TCX-bestand meegestuurd' }, { status: 400 })

    const xmlText = await tcxFile.text()
    let parsed: TcxParsed
    try {
      parsed = parseTcx(xmlText)
    } catch (parseErr) {
      console.error('[garmin-activity-tcx] XML parse fout:', parseErr)
      return NextResponse.json({ error: 'Kon het TCX-bestand niet lezen — is het een geldig Garmin-exportbestand?' }, { status: 422 })
    }

    if (!parsed.duration_min && !parsed.distance_m) {
      return NextResponse.json({ error: 'Geen bruikbare data gevonden in dit bestand' }, { status: 422 })
    }

    const keuzeNodig = bepaalKeuzeNodig(parsed.garmin_sport)
    const suggestie = suggereerType(parsed.garmin_sport, parsed.has_gps)

    const { data: saved, error: saveError } = await adminSupabase
      .from('garmin_activity_imports')
      .insert({
        user_id: user.id,
        parsed_data: parsed,
        confidence_score: keuzeNodig ? 60 : 100,
        status: 'pending',
      })
      .select('id').single()

    if (saveError) throw saveError

    return NextResponse.json({
      success: true,
      import_id: saved.id,
      parsed,
      keuze_nodig: keuzeNodig,
      suggestie,
      opties: ACTIVITEIT_OPTIES,
    })
  } catch (err) {
    console.error('[garmin-activity-tcx]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
