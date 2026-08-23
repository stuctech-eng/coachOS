export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// ── Records — MVP2 ───────────────────────────────────────────────────────
// Leest kettlebell_records. Federatie-/nationale/wereldrecords worden
// NOOIT ongedifferentieerd samengevoegd — federation_id is verplicht in
// het schema en wordt hier altijd meegegeven in de response, zodat de UI
// nooit records van verschillende federaties door elkaar kan tonen.
// Momenteel leeg — geen enkel record is verzonnen of overgenomen van een
// niet-officiële bron (zie eerdere bronrapport over AKLU/CKA).

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const federationId = url.searchParams.get('federation_id')
    const discipline = url.searchParams.get('discipline')

    const supabase = createAdminClient()
    let query = supabase
      .from('kettlebell_records')
      .select('federation_id, record_scope, discipline, category, bell_weight_kg, result_reps, athlete_name, record_date, source')
      .order('record_date', { ascending: false })

    if (federationId) query = query.eq('federation_id', federationId)
    if (discipline) query = query.eq('discipline', discipline)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ records: data || [] })
  } catch (err) {
    console.error('[kettlebell/records GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
