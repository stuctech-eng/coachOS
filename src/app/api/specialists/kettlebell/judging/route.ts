export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// ── Judging — MVP2 ───────────────────────────────────────────────────────
// Puur lezend: geeft de al geïmporteerde WKSF-judgingregels terug
// (v2.4.351, kettlebell_wksf_rules_2023_2027_import.sql). Geen AI-
// interpretatie van de regels — dat is expliciet uitgesloten door de
// gebruiker (§7 van de opdracht: "Geen AI voor de juridische/
// reglementaire beslissing").

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const discipline = url.searchParams.get('discipline')

    const supabase = createAdminClient()
    let query = supabase
      .from('kettlebell_judging_rules')
      .select('discipline, rule_type, description, source_reference')

    if (discipline) {
      query = query.or(`discipline.eq.${discipline},discipline.eq.all`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ regels: data || [] })
  } catch (err) {
    console.error('[kettlebell/judging GET]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
