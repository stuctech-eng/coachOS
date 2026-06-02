export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) return NextResponse.json({ error: 'Geen API key' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: keyData } = await supabase
      .from('health_api_keys')
      .select('user_id')
      .eq('key', apiKey)
      .eq('active', true)
      .single()

    if (!keyData) return NextResponse.json({ error: 'Ongeldige API key' }, { status: 401 })

    const body = await req.json()
    const today = new Date().toISOString().split('T')[0]

    const record: Record<string, unknown> = {
      user_id: keyData.user_id,
      date: today,
      source: 'apple_health',
    }

    if (body.resting_hr)  record.resting_hr     = Math.round(Number(body.resting_hr))
    if (body.hrv)         record.hrv             = Math.round(Number(body.hrv))
    if (body.weight)      record.weight          = Number(body.weight)
    if (body.vo2max)      record.vo2max          = Number(body.vo2max)
    if (body.steps)       record.steps           = Math.round(Number(body.steps))
    if (body.calories)    record.calories_burned = Math.round(Number(body.calories))
    if (body.sleep_hours) record.sleep_duration  = Number(body.sleep_hours)

    const { error } = await supabase
      .from('health_metrics')
      .upsert(record, { onConflict: 'user_id,date' })

    if (error) throw error

    return NextResponse.json({ message: 'Opgeslagen voor ' + today, date: today })

  } catch (error) {
    console.error('Shortcut sync fout:', error)
    return NextResponse.json({ error: 'Sync mislukt' }, { status: 500 })
  }
}
