export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
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

export interface ComplianceData {
  // Algemeen
  totaal_hersteladviezen: number        // Keer coach zei herstel/rust
  gevolgd: number                        // Keer advies gevolgd
  afgeweken: number                      // Keer toch getraind
  compliance_pct: number                 // % advies gevolgd

  // Uitkomst bij afwijken
  afwijkingen_goed: number               // RPE ≤ 6 EN mood ≥ 3
  afwijkingen_zwaar: number              // RPE ≥ 7 OF mood ≤ 2
  afwijkingen_onbekend: number           // Geen evaluatie ingevuld

  // Tekstsamenvatting
  samenvatting: string
  advies: string
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null, { status: 401 })

    const supabase = createAdminClient()
    const dertigDagenGeleden = new Date()
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30)
    const vanDatum = dertigDagenGeleden.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

    // Haal alle coach-aanbevelingen op van laatste 30 dagen
    const { data: coachRecs } = await supabase
      .from('coach_recommendations')
      .select('date, actie_type')
      .eq('user_id', user.id)
      .eq('type', 'coach')
      .in('actie_type', ['herstel', 'rust'])
      .gte('date', vanDatum)
      .order('date', { ascending: false })

    if (!coachRecs || coachRecs.length === 0) {
      return NextResponse.json({
        totaal_hersteladviezen: 0,
        gevolgd: 0,
        afgeweken: 0,
        compliance_pct: 100,
        afwijkingen_goed: 0,
        afwijkingen_zwaar: 0,
        afwijkingen_onbekend: 0,
        samenvatting: 'Nog geen herstel- of rustadviezen gegeven.',
        advies: 'Blijf je check-ins doen zodat de coach je kan begeleiden.',
      })
    }

    // Per herstel/rust-dag: check of er een bibliotheek-training is gedaan
    const hersteldagen = coachRecs.map(r => r.date)

    // Haal training_results op voor die dagen (library = afwijking)
    const { data: trainingen } = await supabase
      .from('training_results')
      .select('date, training_source, rating, actual_duration')
      .eq('user_id', user.id)
      .eq('training_source', 'library')
      .eq('completed', true)
      .in('date', hersteldagen)

    // Haal coach_call_items op voor die dagen (heeft RPE + mood)
    const { data: callItems } = await supabase
      .from('coach_calls')
      .select('date, coach_call_items(rating, mood, status)')
      .eq('user_id', user.id)
      .in('date', hersteldagen)

    // Bouw een map van datum → coach call items
    const callMap: Record<string, { rating: number | null; mood: number | null }[]> = {}
    for (const call of callItems || []) {
      const items = (call.coach_call_items as { rating: number | null; mood: number | null; status: string }[] || [])
        .filter(i => i.status === 'done')
      if (items.length > 0) callMap[call.date] = items
    }

    // Bouw een set van datums waarop er een bibliotheek-training is gedaan
    const afwijkingsDagen = new Set((trainingen || []).map(t => t.date))

    let gevolgd = 0
    let afgeweken = 0
    let afwijkingen_goed = 0
    let afwijkingen_zwaar = 0
    let afwijkingen_onbekend = 0

    for (const dag of hersteldagen) {
      if (afwijkingsDagen.has(dag)) {
        afgeweken++
        const items = callMap[dag] || []
        if (items.length === 0) {
          afwijkingen_onbekend++
        } else {
          // Analyseer uitkomst op basis van RPE + mood
          const gemRpe = items.reduce((a, i) => a + (i.rating || 0), 0) / items.length
          const gemMood = items.reduce((a, i) => a + (i.mood || 0), 0) / items.length
          if (gemRpe <= 6 && gemMood >= 3) {
            afwijkingen_goed++
          } else if (gemRpe >= 7 || gemMood <= 2) {
            afwijkingen_zwaar++
          } else {
            afwijkingen_onbekend++
          }
        }
      } else {
        gevolgd++
      }
    }

    const totaal = coachRecs.length
    const compliance_pct = totaal > 0 ? Math.round((gevolgd / totaal) * 100) : 100

    // Samenvatting genereren
    let samenvatting = ''
    let advies = ''

    if (totaal === 0) {
      samenvatting = 'Nog geen herstel- of rustadviezen in de afgelopen 30 dagen.'
      advies = 'Blijf je check-ins doen zodat de coach je kan begeleiden.'
    } else if (afgeweken === 0) {
      samenvatting = `Je hebt de afgelopen 30 dagen alle ${totaal} hersteladviezen opgevolgd.`
      advies = 'Uitstekend — consistent herstel is de basis van vooruitgang.'
    } else {
      const goedPct = afgeweken > 0 ? Math.round((afwijkingen_goed / afgeweken) * 100) : 0
      const zwaarPct = afgeweken > 0 ? Math.round((afwijkingen_zwaar / afgeweken) * 100) : 0

      samenvatting = `Je bent ${afgeweken}x van het hersteladvies afgeweken (${100 - compliance_pct}% van de tijd).`

      if (afwijkingen_goed > afwijkingen_zwaar) {
        samenvatting += ` ${goedPct}% van die afwijkingen pakte goed uit (lage RPE, goede mood).`
        advies = 'Je luistert goed naar je lichaam ook als je afwijkt. Blijf evalueren na elke training.'
      } else if (afwijkingen_zwaar > afwijkingen_goed) {
        samenvatting += ` ${zwaarPct}% van die afwijkingen was zwaar (hoge RPE of lage mood).`
        advies = 'Afwijken van het hersteladvies pakt regelmatig zwaar uit. Probeer de adviezen vaker op te volgen.'
      } else {
        advies = 'Gemengde resultaten bij afwijkingen — blijf je evaluaties invullen voor beter inzicht.'
      }
    }

    const result: ComplianceData = {
      totaal_hersteladviezen: totaal,
      gevolgd,
      afgeweken,
      compliance_pct,
      afwijkingen_goed,
      afwijkingen_zwaar,
      afwijkingen_onbekend,
      samenvatting,
      advies,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[compliance GET]', err)
    return NextResponse.json(null, { status: 500 })
  }
}
