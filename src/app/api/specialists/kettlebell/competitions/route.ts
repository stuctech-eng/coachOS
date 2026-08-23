export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// ── Competitions (referentiedata) — MVP2 ────────────────────────────────
// Leest kettlebell_competitions. Momenteel leeg — er is bewust geen
// enkele wedstrijd verzonnen/geseed; officiële wedstrijdkalenders moeten
// net als de classificatienormen uit een echte bron komen.

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_competitions')
      .select('id, name, event_date, location, federation_id')
      .order('event_date', { ascending: true })

    if (error) throw error
    return NextResponse.json({ competities: data || [] })
  } catch (err) {
    console.error('[kettlebell/competitions GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
