import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Shortcut stuurt JSON met API key in header
// Format: { days: [ { date, steps, resting_hr, hrv, weight, sleep_hours, calories, vo2max } ] }

export async function POST(req: NextRequest) {
  try {
    // Auth via API key in header
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return NextResponse.json({ error: 'Geen API key' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Zoek gebruiker op basis van API key
    const { data: keyData } = await supabase
      .from('health_api_keys')
      .select('user_id')
      .eq('key', apiKey)
      .eq('active', true)
      .single()

    if (!keyData) {
      return NextResponse.json({ error: 'Ongeldige API key' }, { status: 401 })
    }

    const userId = keyData.user_id
    const body = await req.json()

    if (!body.days || !Array.isArray(body.days)) {
      return NextResponse.json({ error: 'Ongeldig formaat' }, { status: 400 })
    }

    let imported = 0
    let skipped = 0

    const records = body.days
      .filter((d: Record<string, unknown>) => d.date)
      .map((d: Record<string, unknown>) => {
        const record: Record<string, unknown> = {
          user_id: userId,
          date: d.date,
          source: 'apple_health',
        }
        if (d.resting_hr)    record.resting_hr      = Math.round(Number(d.resting_hr))
        if (d.hrv)           record.hrv              = Math.round(Number(d.hrv))
        if (d.weight)        record.weight           = Number(d.weight)
        if (d.vo2max)        record.vo2max           = Number(d.vo2max)
        if (d.steps)         record.steps            = Math.round(Number(d.steps))
        if (d.calories)      record.calories_burned  = Math.round(Number(d.calories))
        if (d.sleep_hours)   record.sleep_duration   = Number(d.sleep_hours)
        return record
      })

    // Upsert in batches van 50
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50)
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
    })

  } catch (error) {
    console.error('Shortcut import fout:', error)
    return NextResponse.json({ error: 'Import mislukt' }, { status: 500 })
  }
}
