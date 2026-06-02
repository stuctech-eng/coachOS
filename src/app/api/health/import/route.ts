export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Vercel body size limit
export const config = {
  api: {
    bodyParser: false,
  },
}

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

// Haal alle waarden op van een bepaald type uit de XML
function extractRecords(xml: string, type: string): { date: string; value: number }[] {
  const results: Map<string, number[]> = new Map()
  const regex = new RegExp(
    `<Record[^>]*type="${type}"[^>]*value="([^"]+)"[^>]*startDate="([^"]+)"[^>]*\/?>`,
    'g'
  )
  // Ook omgekeerde volgorde van attributen
  const regex2 = new RegExp(
    `<Record[^>]*startDate="([^"]+)"[^>]*type="${type}"[^>]*value="([^"]+)"[^>]*\/?>`,
    'g'
  )

  for (const r of [regex, regex2]) {
    let match
    while ((match = r.exec(xml)) !== null) {
      const isFirst = r === regex
      const value = parseFloat(isFirst ? match[1] : match[2])
      const dateStr = isFirst ? match[2] : match[1]
      if (isNaN(value)) continue
      const date = dateStr.split(' ')[0]
      if (!results.has(date)) results.set(date, [])
      results.get(date)!.push(value)
    }
  }

  return Array.from(results.entries()).map(([date, values]) => ({
    date,
    value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
  }))
}

function sumRecords(xml: string, type: string): Map<string, number> {
  const results: Map<string, number> = new Map()
  const regex = new RegExp(
    `<Record[^>]*type="${type}"[^>]*value="([^"]+)"[^>]*startDate="([^"]+)"[^>]*\/?>`,
    'g'
  )
  let match
  while ((match = regex.exec(xml)) !== null) {
    const value = parseFloat(match[1])
    const date = match[2].split(' ')[0]
    if (isNaN(value)) continue
    results.set(date, (results.get(date) || 0) + value)
  }
  return results
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xml') {
      return NextResponse.json({ error: 'Alleen export.xml wordt ondersteund' }, { status: 400 })
    }

    // Lees XML — kan groot zijn, we parsen met regex
    const xml = await file.text()

    // Extraheer alle data types
    const hartslag     = extractRecords(xml, 'HKQuantityTypeIdentifierHeartRate')
    const hrv          = extractRecords(xml, 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN')
    const gewicht      = extractRecords(xml, 'HKQuantityTypeIdentifierBodyMass')
    const vo2max       = extractRecords(xml, 'HKQuantityTypeIdentifierVO2Max')
    const slaapScore   = extractRecords(xml, 'HKCategoryTypeIdentifierSleepAnalysis')
    const stressSom    = sumRecords(xml, 'HKQuantityTypeIdentifierAppleExerciseTime')
    const stepsSom     = sumRecords(xml, 'HKQuantityTypeIdentifierStepCount')
    const caloriesSom  = sumRecords(xml, 'HKQuantityTypeIdentifierActiveEnergyBurned')

    // Slaap: tel minuten per dag
    const slaapMinuten: Map<string, number> = new Map()
    const slaapRegex = /<Record[^>]*type="HKCategoryTypeIdentifierSleepAnalysis"[^>]*value="HKCategoryValueSleepAnalysisAsleep[^"]*"[^>]*startDate="([^"]+)"[^>]*endDate="([^"]+)"[^>]*\/?>/g
    let slaapMatch
    while ((slaapMatch = slaapRegex.exec(xml)) !== null) {
      const start = new Date(slaapMatch[1])
      const end = new Date(slaapMatch[2])
      const minuten = Math.round((end.getTime() - start.getTime()) / 60000)
      const date = slaapMatch[1].split(' ')[0]
      slaapMinuten.set(date, (slaapMinuten.get(date) || 0) + minuten)
    }

    // Verzamel alle unieke datums
    const allDates = new Set<string>([
      ...hartslag.map(r => r.date),
      ...hrv.map(r => r.date),
      ...gewicht.map(r => r.date),
      ...vo2max.map(r => r.date),
      ...stressSom.keys(),
      ...stepsSom.keys(),
      ...caloriesSom.keys(),
      ...slaapMinuten.keys(),
    ])

    if (allDates.size === 0) {
      return NextResponse.json({ error: 'Geen gezondheidsdata gevonden in dit bestand' }, { status: 400 })
    }

    // Maak lookup maps
    const hartslagMap = new Map(hartslag.map(r => [r.date, r.value]))
    const hrvMap      = new Map(hrv.map(r => [r.date, r.value]))
    const gewichtMap  = new Map(gewicht.map(r => [r.date, r.value]))
    const vo2maxMap   = new Map(vo2max.map(r => [r.date, r.value]))

    const supabase = createAdminClient()
    let imported = 0
    let skipped = 0

    // Verwerk per datum
    const records = Array.from(allDates).map(date => {
      const record: Record<string, unknown> = {
        user_id: user.id,
        date,
        source: 'apple_health',
      }
      if (hartslagMap.has(date))  record.resting_hr      = Math.round(hartslagMap.get(date)!)
      if (hrvMap.has(date))       record.hrv              = Math.round(hrvMap.get(date)!)
      if (gewichtMap.has(date))   record.weight           = gewichtMap.get(date)
      if (vo2maxMap.has(date))    record.vo2max           = vo2maxMap.get(date)
      if (stepsSom.has(date))     record.steps            = Math.round(stepsSom.get(date)!)
      if (caloriesSom.has(date))  record.calories_burned  = Math.round(caloriesSom.get(date)!)
      if (slaapMinuten.has(date)) record.sleep_duration   = Math.round(slaapMinuten.get(date)! / 60 * 10) / 10
      return record
    })

    // Upsert in batches van 100
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100)
      const { error } = await supabase
        .from('health_metrics')
        .upsert(batch, { onConflict: 'user_id,date', ignoreDuplicates: false })
      if (error) {
        console.error('Upsert fout:', error)
        skipped += batch.length
      } else {
        imported += batch.length
      }
    }

    return NextResponse.json({
      message: `${imported} dagen geïmporteerd`,
      imported,
      skipped,
      dates: allDates.size,
    })

  } catch (error) {
    console.error('Apple Health import fout:', error)
    return NextResponse.json({ error: 'Import mislukt' }, { status: 500 })
  }
}
