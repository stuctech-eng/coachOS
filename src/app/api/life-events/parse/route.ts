export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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

// ── Coach Agenda Fase B — AI-invoer (parse-only) ────────────────────────
// Bron: overleg 30 juli 2026. Niet-onderhandelbaar architectuurprincipe,
// zelfde filosofie als CoachOS' allereerste kernregel ("AI never
// creates exercises"): AI mag NOOIT zelfstandig een regel opslaan. Deze
// route doet UITSLUITEND het interpreteren — het geeft een voorstel
// terug, slaat niets op. De daadwerkelijke opslag loopt via de
// bestaande, al-geteste POST /api/life-events, pas na expliciete
// bevestiging door de gebruiker in de UI.
//
// LET OP: de typelijst hieronder moet in sync blijven met
// EVENT_CATEGORIES in src/app/life-events/page.tsx. Bewust hier
// gedupliceerd i.p.v. geïmporteerd — dit is een API-route (server),
// life-events/page.tsx is 'use client'; een gedeeld bestand zou een
// kleine, aparte opschoning zijn, geen blokkade voor deze fase.

const TYPE_VOCABULAIRE = `
WERK: nachtdienst, avonddienst, vroege_dienst, dagdienst, thuiswerken, lange_dag, vrije_dag, werk_stress, consignatie
LEVEN: vakantie, reizen, feest, sociaal, jetlag, verjaardag, bruiloft, begrafenis, weekend_weg, zakenreis, lange_autorit, vlucht, hotel
GEZONDHEID: ziek, emotionele_stress, slecht_geslapen, hersteldag
MEDISCH: huisarts, fysiotherapeut, sportarts, specialist, massage, medisch_onderzoek, vaccinatie
SPORT: trainingskamp, testdag, clubrit, evenement
OMGEVING: extreme_hitte
`.trim()

const GELDIGE_TYPES = new Set(
  TYPE_VOCABULAIRE.split('\n').flatMap(regel => regel.split(':')[1]?.split(',').map(t => t.trim()) || [])
)

interface ParseResultaat {
  gelukt: boolean
  type?: string
  start_datum?: string
  start_uur?: number | null
  eind_uur?: number | null
  recurrence?: 'workdays' | 'weekend' | 'weekly' | 'biweekly' | 'daily' | 'custom' | null
  recurrence_dagen?: number[] | null
  eind_datum?: string | null
  prioriteit?: 'laag' | 'normaal' | 'hoog' | null
  beschikbare_tijd_minuten?: number | null
  notitie?: string | null
  samenvatting?: string
  reden_mislukt?: string
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { text } = await req.json()
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Geen tekst ontvangen' }, { status: 400 })
    }

    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const vandaagNummer = new Date().getDay() // 0=zo, 1=ma, ... 6=za — let op: JS-conventie, niet ISO

    const systemPrompt = `Je bent een strikt data-extractie-systeem voor CoachOS' Coach Agenda.
Je taak: zet een vrije Nederlandse tekst om naar een gestructureerd JSON-object.

BELANGRIJKE REGELS:
1. Je MAG UITSLUITEND een type kiezen uit deze lijst, exact zoals gespeld — nooit een nieuw type verzinnen:
${TYPE_VOCABULAIRE}
2. Als de tekst niet duidelijk bij één van deze types past, geef dan "gelukt": false met een reden. Gok niet.
3. Vandaag is ${vandaag} (dagnummer ${vandaagNummer}, waarbij 0=zondag, 1=maandag, ... 6=zaterdag).
4. Voor "recurrence": gebruik "weekly" bij "elke [dag]" of "iedere [dag]", "workdays" bij "op werkdagen", "weekend" bij "in het weekend", "daily" bij "elke dag", null bij een eenmalige gebeurtenis.
5. Voor "recurrence_dagen": array met dagnummers (0-6, JS-conventie) als er een specifieke dag genoemd wordt bij een wekelijkse regel — bijv. "elke woensdag" → [3].
6. Voor "start_datum": bepaal een concrete datum (yyyy-mm-dd) uit relatieve tijdsaanduidingen ("volgende week", "vanaf morgen", etc.) — reken vanaf vandaag.
7. Geef ALTIJD een korte "samenvatting" in natuurlijke taal die de gebruiker kan bevestigen, bijv. "Fysiotherapeut, elke woensdag, vanaf nu, geen einddatum".
8. Verzin GEEN prioriteit, beschikbare tijd of notitie als de gebruiker dat niet noemt — laat dan null.

Reageer ALLEEN met geldige JSON, geen uitleg eromheen:
{
  "gelukt": true,
  "type": "...",
  "start_datum": "yyyy-mm-dd",
  "start_uur": null,
  "eind_uur": null,
  "recurrence": null,
  "recurrence_dagen": null,
  "eind_datum": null,
  "prioriteit": null,
  "beschikbare_tijd_minuten": null,
  "notitie": null,
  "samenvatting": "..."
}
Of bij twijfel:
{ "gelukt": false, "reden_mislukt": "..." }`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!aiRes.ok) {
      return NextResponse.json({ gelukt: false, reden_mislukt: 'AI-dienst tijdelijk niet bereikbaar' } as ParseResultaat)
    }

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ gelukt: false, reden_mislukt: 'Kon de tekst niet interpreteren' } as ParseResultaat)
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParseResultaat

    // v2.4.188: harde validatie-laag, ONAFHANKELIJK van de AI-prompt —
    // de AI kan een instructie negeren, deze check kan dat niet. Een
    // type buiten de bekende vocabulaire wordt hier alsnog geblokkeerd,
    // ongeacht wat de AI beweert.
    if (parsed.gelukt && (!parsed.type || !GELDIGE_TYPES.has(parsed.type))) {
      return NextResponse.json({
        gelukt: false,
        reden_mislukt: 'Kon dit niet aan een bekend type koppelen — probeer het preciezer te omschrijven of kies handmatig een categorie.',
      } as ParseResultaat)
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[life-events/parse]', err)
    return NextResponse.json({ gelukt: false, reden_mislukt: 'Er ging iets mis bij het interpreteren' } as ParseResultaat)
  }
}
