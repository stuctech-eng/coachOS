export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { isoDatum } from '@/utils'
import { verwerkScreenshot } from '@/lib/vision-engine/core'
import { garminHealthParser } from '@/lib/vision-engine/garmin-health-parser'
import { garminPerformanceParser } from '@/lib/vision-engine/garmin-performance-parser'

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

// ── Vision Import — één upload, twee screenshots ────────────────────────
// Bron: overleg 20 juli 2026. Verwerkt Health- en Performance-screenshot
// in één keer (twee losse Vision-calls via de Vision Engine-parsers,
// geen alles-in-één-prompt — hogere herkenningsbetrouwbaarheid per
// scherm). Beide zijn optioneel — je kunt er ook maar één uploaden.
//
// Health-foto schrijft ALTIJD ook naar het bestaande garmin_imports
// (ongewijzigd, 15+ bestaande lezers blijven werken), plus nieuw naar
// morning_health_metrics. Performance-foto is uitsluitend nieuw
// (performance_snapshots), er was geen eerdere tabel voor.
//
// Bewuste vereenvoudiging t.o.v. de bestaande garmin-vision-route: geen
// apart "bevestig eerst"-stapje — direct opslaan na parsen. Kan later
// alsnog toegevoegd worden als gewenst.
//
// Bewuste beperking bij gemengde bronnen op dezelfde dag: source_type/
// import_method op de rij weerspiegelen de LAATSTE schrijfactie voor die
// dag, niet per veld. Bijv. eerst handmatig HRV invullen en later
// dezelfde dag een Health-screenshot uploaden zet source_type om naar
// 'garmin_connect' voor de hele rij, ook al blijft de handmatige HRV-
// waarde zelf intact (velden worden gemerged, niet overschreven met
// null). Voor de eerste versie een aanvaardbare vereenvoudiging.

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const formData = await req.formData()
    const healthFile = formData.get('health_image') as File | null
    const performanceFile = formData.get('performance_image') as File | null

    if (!healthFile && !performanceFile) {
      return NextResponse.json({ error: 'Geen afbeelding meegestuurd' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const vandaag = isoDatum(new Date())
    const resultaat: Record<string, unknown> = {}

    if (healthFile) {
      try {
        const buffer = Buffer.from(await healthFile.arrayBuffer())
        const { parsed, raw_response, confidence, flags } = await verwerkScreenshot(garminHealthParser, buffer)

        // Bestaande garmin_imports blijft gevoed — 15+ bestaande lezers
        // (Coach AI, Trends, Predictions, Status, Memory, Home, Insights,
        // Training-flows) mogen hier niets van merken
        // v2.4.139-fix: status altijd 'confirmed' — deze route heeft
        // bewust geen apart bevestigstapje (v2.4.137-keuze), dus opslaan
        // IS het bevestigen. Zonder deze fix bleef de Home-kaart
        // "Garmin data importeren" altijd zichtbaar, want die check kijkt
        // specifiek naar status==='confirmed' (zie home/page.tsx).
        // validation_flags blijft gewoon apart opgeslagen voor wie
        // afwijkende waarden wil nakijken — dat hoeft de reminder-kaart
        // niet te blokkeren.
        const status = 'confirmed'
        await supabase.from('garmin_imports').upsert({
          user_id: user.id, date: vandaag,
          raw_vision_response: raw_response, parsed_data: parsed,
          validation_flags: flags, confidence_score: confidence, status,
        }, { onConflict: 'user_id,date' })

        // Nieuw: genormaliseerd naar morning_health_metrics — merge met
        // een eventueel al-bestaande rij van vandaag (bijv. handmatige
        // HRV eerder die dag), niet blind overschrijven
        const { data: bestaand } = await supabase
          .from('morning_health_metrics')
          .select('*')
          .eq('user_id', user.id).eq('date', vandaag).maybeSingle()

        await supabase.from('morning_health_metrics').upsert({
          ...(bestaand || {}),
          user_id: user.id, date: vandaag,
          hrv_7d_avg_ms: parsed.hrv.avg_7d_ms,
          hrv_status: parsed.hrv.status,
          resting_hr: parsed.resting_hr,
          body_battery_current: parsed.body_battery.current,
          body_battery_charged: parsed.body_battery.charged,
          body_battery_spent: parsed.body_battery.spent,
          sleep_score: parsed.sleep.score,
          sleep_duration_minutes: parsed.sleep.duration_minutes,
          stress: parsed.stress,
          respiration_current_brpm: parsed.breathing.current_brpm,
          respiration_avg_awake_brpm: parsed.breathing.avg_awake_brpm,
          respiration_avg_sleep_brpm: parsed.breathing.avg_sleep_brpm,
          source_type: 'garmin_connect', import_method: 'vision',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' })

        // v2.4.144 (Niveau 1 — datastroom-fix): ook naar health_metrics,
        // met ALLE relevante velden — niet alleen HRV. Zonder dit ziet
        // calculateRecoveryScore() (CoachPolicy) rusthartslag/Body
        // Battery/slaapscore/slaapduur nooit, ook al staan ze allang in
        // de formule. Merge met een bestaande rij van vandaag (bijv. al
        // een handmatige HRV-invoer) — niet blind overschrijven.
        const { data: bestaandeHealthMetrics } = await supabase
          .from('health_metrics')
          .select('*')
          .eq('user_id', user.id).eq('date', vandaag).maybeSingle()

        // v2.4.145-fix: GEEN upsert-met-onConflict meer — die faalt STIL
        // (Supabase geeft databasefouten terug als {error}, niet als
        // exception) als health_metrics geen unieke sleutel op
        // (user_id, date) heeft die exact bij 'user_id,date' past. Dat
        // bleek precies te gebeuren: het scherm toonde "Opgeslagen ✓",
        // maar rusthartslag/Body Battery/slaapscore kwamen nooit aan.
        // Nu expliciet: eerst ophalen (al gedaan, bestaandeHealthMetrics
        // hierboven), dan UPDATE als er al een rij is, anders INSERT —
        // kan niet stil mislukken op een sleutel-mismatch. Fout wordt nu
        // ook gelogd i.p.v. genegeerd.
        const healthMetricsPayload = {
          hrv: bestaandeHealthMetrics?.hrv ?? parsed.hrv.avg_7d_ms,
          resting_hr: parsed.resting_hr,
          body_battery: parsed.body_battery.current,
          sleep_score: parsed.sleep.score,
          sleep_duration: parsed.sleep.duration_minutes ? Math.round((parsed.sleep.duration_minutes / 60) * 10) / 10 : null,
        }
        if (bestaandeHealthMetrics?.id) {
          const { error: updateErr } = await supabase.from('health_metrics').update(healthMetricsPayload).eq('id', bestaandeHealthMetrics.id)
          if (updateErr) console.error('[vision-import] health_metrics UPDATE mislukt:', updateErr)
        } else {
          const { error: insertErr } = await supabase.from('health_metrics').insert({ user_id: user.id, date: vandaag, ...healthMetricsPayload })
          if (insertErr) console.error('[vision-import] health_metrics INSERT mislukt:', insertErr)
        }

        resultaat.health = { parsed, confidence, flags }
      } catch (healthErr) {
        console.error('[vision-import] Health-foto mislukt:', healthErr)
        resultaat.health = { error: (healthErr as Error).message || 'Verwerken mislukt' }
      }
    }

    if (performanceFile) {
      try {
        const buffer = Buffer.from(await performanceFile.arrayBuffer())
        const { parsed, confidence, flags } = await verwerkScreenshot(garminPerformanceParser, buffer)

        await supabase.from('performance_snapshots').upsert({
          user_id: user.id, date: vandaag,
          ...parsed,
          source_type: 'garmin_connect', import_method: 'vision',
        }, { onConflict: 'user_id,date' })

        resultaat.performance = { parsed, confidence, flags }
      } catch (perfErr) {
        console.error('[vision-import] Performance-foto mislukt:', perfErr)
        resultaat.performance = { error: (perfErr as Error).message || 'Verwerken mislukt' }
      }
    }

    return NextResponse.json(resultaat)
  } catch (err) {
    console.error('[vision-import]', err)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
