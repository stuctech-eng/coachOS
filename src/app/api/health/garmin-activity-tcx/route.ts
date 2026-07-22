export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { bepaalKeuzeNodig, suggereerType, ACTIVITEIT_OPTIES, type TcxParsed } from '@/lib/tcx-parser'

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

// v2.4.35 FIX: het volledige TCX-bestand werd voorheen naar deze route
// geüpload (multipart/form-data) om server-side te parsen. Bij lange
// activiteiten (veel trackpoints) overschreed dat Vercel's payload-limiet
// voor serverless functions (~4,5MB) — 413 FUNCTION_PAYLOAD_TOO_LARGE.
// Het parsen gebeurt nu volledig in de browser (src/lib/tcx-parser.ts,
// isomorf, hergebruikt hier alleen nog voor de type-definitie en de
// suggestie-functies). Deze route ontvangt nu alleen het kleine,
// al-samengevatte resultaat (JSON, een paar KB) — nooit meer het volledige
// bestand. Lost het probleem op ongeacht hoe lang een activiteit duurt.
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const adminSupabase = createAdminClient()
    const contentType = req.headers.get('content-type') || ''

    // ── Confirm flow — blijft FormData (klein: alleen confirm_id + type) ──
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const confirmId = formData.get('confirm_id') as string | null
      const gekozenType = formData.get('activity_type') as string | null

      if (!confirmId) return NextResponse.json({ error: 'confirm_id ontbreekt' }, { status: 400 })

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

      // v2.4.112 FIX: activiteitsdatum werd altijd op VANDAAG gezet,
      // ongeacht de daadwerkelijke datum in het TCX-bestand — een
      // historische import (bijv. een rit van vorige maand) kwam
      // daardoor op de verkeerde dag te staan. parsed.start_date (het
      // <Id>-element, ISO-tijdstip) werd al gebruikt in `notes` voor
      // duplicaat-detectie, maar nooit voor het daadwerkelijke `date`-
      // veld. Nu wel: de activiteitsdatum wordt afgeleid uit het
      // bestand zelf, met `today` alleen als noodgreep als het bestand
      // geen bruikbare datum bevat.
      const activiteitDatum = parsed.start_date
        ? new Date(parsed.start_date).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
        : today

      const metrics: Record<string, unknown> = {}
      if (parsed.distance_m) metrics.distance = parsed.distance_m
      if (parsed.avg_hr) metrics.avg_hr = parsed.avg_hr
      if (parsed.max_hr) metrics.max_hr = parsed.max_hr
      if (parsed.calories) metrics.calories = parsed.calories
      if (parsed.avg_cadence) metrics.avg_cadence = parsed.avg_cadence
      if (parsed.max_cadence) metrics.max_cadence = parsed.max_cadence
      if (parsed.avg_watts) metrics.avg_watts = parsed.avg_watts
      if (parsed.max_watts) metrics.max_watts = parsed.max_watts
      if (parsed.avg_speed_kmh) metrics.avg_speed = parsed.avg_speed_kmh
      if (parsed.max_speed_kmh) metrics.max_speed = parsed.max_speed_kmh
      if (parsed.elevation_gain_m) metrics.elevation_gain = parsed.elevation_gain_m
      if (parsed.elevation_loss_m) metrics.elevation_loss = parsed.elevation_loss_m
      if (parsed.route && parsed.route.length > 0) metrics.route = parsed.route
      // v2.4.165: split-analyse (negative/positive split + pacing-
      // consistentie) — Running Specialist Fase 2 (Professional)
      if (parsed.split_analyse) metrics.split_analyse = parsed.split_analyse

      // v2.4.42 FIX: was een harde 409-blokkade bij hetzelfde TCX-bestand.
      // Nu: OVERSCHRIJVEN in plaats van weigeren — verst de metrics op de
      // bestaande rij (bijv. route die er bij de eerste import nog niet
      // was, vóór v2.4.41). Bewust GEEN nieuwe Coach Call — dat zou een
      // al-geëvalueerde training opnieuw om RPE/mood vragen, verwarrend
      // voor iets wat feitelijk dezelfde training is. Wel het bestaande
      // coach_call_item.duration_min bijwerken als de duur is veranderd
      // (bv. door een verbeterde parser), zodat een nog-niet-ingevulde
      // evaluatie de juiste duur toont.
      if (parsed.start_date) {
        const { data: bestaandeSessie } = await adminSupabase
          .from('activity_sessions')
          .select('id, duration')
          .eq('user_id', user.id)
          .ilike('notes', '%garmin_tcx_start:' + parsed.start_date + '%')
          .single()

        if (bestaandeSessie) {
          const { error: updateError } = await adminSupabase
            .from('activity_sessions')
            .update({ metrics, duration: durationMin })
            .eq('id', bestaandeSessie.id)

          if (updateError) throw updateError

          if (bestaandeSessie.duration !== durationMin) {
            await adminSupabase
              .from('coach_call_items')
              .update({ duration_min: durationMin })
              .eq('activity_session_id', bestaandeSessie.id)
          }

          // v2.4.110: vermogenscurve ook bijwerken bij een overschrijving
          // (bijv. opnieuw uploaden na een parser-verbetering) — upsert
          // i.p.v. insert, want de unique-constraint (activity_id,
          // duration_sec) zou een plain insert laten falen bij een
          // tweede keer
          if (parsed.vermogenscurve && parsed.vermogenscurve.length > 0) {
            try {
              await adminSupabase.from('cycling_power_curve').upsert(
                parsed.vermogenscurve.map(punt => ({
                  activity_id: bestaandeSessie.id,
                  user_id: user.id,
                  duration_sec: punt.duration_sec,
                  watts: punt.watts,
                })),
                { onConflict: 'activity_id,duration_sec' }
              )
            } catch (curveErr) {
              console.error('[garmin-activity-tcx] Vermogenscurve bijwerken mislukt:', curveErr)
            }
          }

          // v2.4.128: afstandscurve bijwerken bij overschrijving — alleen
          // voor Hardlopen, zelfde upsert-reden als vermogenscurve
          // hierboven
          if (activityLabel === 'Hardlopen' && parsed.afstandscurve && parsed.afstandscurve.length > 0) {
            try {
              await adminSupabase.from('running_distance_records').upsert(
                parsed.afstandscurve.map(punt => ({
                  activity_id: bestaandeSessie.id,
                  user_id: user.id,
                  distance_m: punt.afstand_m,
                  tijd_sec: punt.tijd_sec,
                })),
                { onConflict: 'activity_id,distance_m' }
              )
            } catch (curveErr) {
              console.error('[garmin-activity-tcx] Afstandscurve bijwerken mislukt:', curveErr)
            }
          }

          await adminSupabase.from('garmin_activity_imports')
            .update({ status: 'confirmed', activity_session_id: bestaandeSessie.id })
            .eq('id', confirmId)

          return NextResponse.json({
            success: true, confirmed: true, overwritten: true,
            activity_session_id: bestaandeSessie.id,
          })
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

      const { data: session, error: sessionError } = await adminSupabase
        .from('activity_sessions')
        .insert({
          user_id: user.id,
          activity_id: userActivity?.id || null,
          date: activiteitDatum,
          duration: durationMin,
          metrics,
          source: 'garmin',
          notes: 'garmin_tcx_import:' + confirmId + (parsed.start_date ? ' garmin_tcx_start:' + parsed.start_date : ''),
        })
        .select('id').single()

      if (sessionError) throw sessionError

      // v2.4.110: vermogenscurve opslaan, indien berekend. Eigen
      // try/catch — een probleem hier mag de import nooit laten falen,
      // de kernactiviteit is al succesvol opgeslagen op dit punt.
      if (parsed.vermogenscurve && parsed.vermogenscurve.length > 0) {
        try {
          await adminSupabase.from('cycling_power_curve').insert(
            parsed.vermogenscurve.map(punt => ({
              activity_id: session.id,
              user_id: user.id,
              duration_sec: punt.duration_sec,
              watts: punt.watts,
            }))
          )
        } catch (curveErr) {
          console.error('[garmin-activity-tcx] Vermogenscurve opslaan mislukt:', curveErr)
        }
      }

      // v2.4.128: afstandscurve opslaan, indien berekend — alleen voor
      // Hardlopen (distance records zijn een Running-specifiek concept).
      // Eigen try/catch, zelfde reden als vermogenscurve hierboven.
      if (activityLabel === 'Hardlopen' && parsed.afstandscurve && parsed.afstandscurve.length > 0) {
        try {
          await adminSupabase.from('running_distance_records').insert(
            parsed.afstandscurve.map(punt => ({
              activity_id: session.id,
              user_id: user.id,
              distance_m: punt.afstand_m,
              tijd_sec: punt.tijd_sec,
            }))
          )
        } catch (curveErr) {
          console.error('[garmin-activity-tcx] Afstandscurve opslaan mislukt:', curveErr)
        }
      }

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

    // ── Extract flow — v2.4.35: ontvangt nu JSON met het AL-GEPARSTE
    // resultaat (berekend in de browser), niet meer het ruwe bestand ──────
    const body = await req.json().catch(() => null)
    const parsed = body?.parsed as TcxParsed | undefined

    if (!parsed) {
      return NextResponse.json({ error: 'Geen geparste data meegestuurd' }, { status: 400 })
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
