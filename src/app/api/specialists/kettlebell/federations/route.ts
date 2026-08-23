export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// ── Federaties (referentiedata) — MVP2 ──────────────────────────────────
// Leest kettlebell_federations (WKSF/IUKL/GSU-skeleton, sinds v2.4.349).
// Puur lezend, geen schrijftoegang vanuit de client.

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('kettlebell_federations')
      .select('id, slug, name')
      .order('slug', { ascending: true })

    if (error) throw error
    return NextResponse.json({ federaties: data || [] })
  } catch (err) {
    console.error('[kettlebell/federations GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
