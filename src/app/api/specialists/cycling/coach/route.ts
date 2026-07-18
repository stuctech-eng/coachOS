export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { analyseerCycling } from '@/lib/specialists/cycling-analysis'
import { verwerkKandidaatInzicht, haalMemoryOp } from '@/lib/specialists/learning-engine'
import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'
import { haalGoalsMetProgress } from '@/lib/specialists/goal-engine'
import { COACH_CORE_IDENTITY, CORE_SAFETY_RULE, getCoachTone } from '@/core/prompts/coach-personality'

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

export interface CyclingCoachAdvies {
  samenvatting: string
  sterke_punten: string
  aandachtspunten: string
  advies: string
  generated_at: string
}

// v2.4.75: apart van het advies zelf — de AI mag hooguit 0-2
// kandidaat-inzichten voorstellen per keer, bewust NIET onderdeel van
// CyclingCoachAdvies (dat blijft de opgeslagen analyse-vorm,
// ongewijzigd t.o.v. eerdere versies). Kandidaten gaan direct door de
// Learning Engine, worden niet zelf opgeslagen als "waarheid" door de AI.
interface KandidaatInzichtRuw {
  category: 'training_response' | 'preference' | 'risk_pattern'
  insight: string
}

// v2.4.79: SpecialistSummary, bron docs/specialist-coach-policy.md.
// Wordt door de AI zelf ingevuld (binnen de door CoachPolicy gestelde
// grenzen) — bewust NIET opgeslagen in specialist_analyses.analysis
// (dat blijft exact CyclingCoachAdvies), alleen meegegeven in de
// API-response, klaar voor de Master Coach om straks te lezen
// (nog te bouwen, apart afgestemde stap — raakt api/coach/route.ts).
interface SpecialistSummary {
  specialist: 'cycling'
  load: 'low' | 'moderate' | 'high'
  progress: 'improving' | 'stable' | 'declining'
  risk: 'none' | 'low' | 'high'
  recommendation: string
  confidence: number
  reasons: string[]
}

// ── Fase 3 — Cycling Coach Layer ────────────────────────────────────────
// Bron: docs/specialist-api.md Fase 3. EERSTE AI-CALL in de
// specialistlaag. Roept intern Fase 2b aan (analyseerCycling) — geen
// nieuwe berekening hier, alleen interpretatie van al-berekende cijfers.
//
// Personality: hergebruikt COACH_CORE_IDENTITY/CORE_SAFETY_RULE/
// getCoachTone(2) uit de BESTAANDE coach-personality.ts.
//
// v2.4.75 — Memory Engine sub-stap 3: de AI mag nu ook (optioneel,
// max 2 per keer) kandidaat-inzichten voorstellen naast het advies.
// Deze gaan NOOIT direct het geheugen in — ze worden doorgegeven aan de
// Learning Engine (verwerkKandidaatInzicht), die deterministisch beslist
// of het een bevestiging is en of promotie naar 'active' plaatsvindt.
// De AI schrijft dus zelf niet naar specialist_memory, exact zoals
// vastgelegd in specialist-memory.md ("AI leest Memory wel, schrijft er
// nooit rechtstreeks naartoe").
//
// v2.4.79 — CoachPolicy/SpecialistSummary-contract (docs/specialist-
// coach-policy.md). CoachPolicy wordt HIER opgehaald (deterministisch,
// genereerCoachPolicy) en als harde grenzen in de prompt gezet — de AI
// mag nooit een verboden trainingstype aanraden. AI retourneert op zijn
// beurt een SpecialistSummary, klaar voor de Master Coach om te lezen
// (v2.4.80, api/coach/route.ts leest dit inmiddels terug).
//
// v2.4.82 — Memory Engine sub-stap 5/5, LAATSTE STAP: 'active'-Memory-
// items (Learning Engine, sub-stap 2) met actuele confidence (Confidence
// Engine, sub-stap 4) worden hier gelezen en als achtergrondkennis in de
// prompt gezet. Hiermee is de volledige cyclus gesloten:
// AI stelt voor → Learning Engine bevestigt → Confidence Engine
// onderhoudt → Coach Layer leest terug → AI gebruikt het.

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null)
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('specialist_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('specialist_type', 'cycling')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const supabase = createAdminClient()

    const body = await req.json().catch(() => ({}))
    const periodDays = body.period_days || 90

    // Cache — max 1 analyse per 24 uur, zelfde patroon als progress-analysis
    const gisteren = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from('specialist_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('specialist_type', 'cycling')
      .gte('generated_at', gisteren)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) return NextResponse.json(cached)

    // ── Fase 2b aanroepen — intern, geen HTTP-roundtrip ──────────────
    const engineResultaat = await analyseerCycling(user.id, periodDays)

    // ── v2.4.79: CoachPolicy ophalen — deterministisch, geen AI-aanroep.
    // De Cycling Coach krijgt hiermee harde grenzen (max intensiteit,
    // verboden trainingstypes), gebaseerd op de bestaande
    // calculateRecoveryScore(). Zie docs/specialist-coach-policy.md.
    const policy = await genereerCoachPolicy(user.id)

    // ── v2.4.82: Memory Engine sub-stap 5 — terugkoppeling naar de Coach
    // Layer. Alleen 'active'-items (dus al meermaals bevestigd door de
    // Learning Engine, niet zomaar een eenmalige AI-gok) worden gelezen.
    // haalMemoryOp() past decay al toe vóór teruggave (Confidence Engine,
    // sub-stap 4) — wat hier binnenkomt is dus altijd de actuele stand.
    let memoryContext = ''
    try {
      const actieveMemory = await haalMemoryOp(user.id, 'cycling', true)
      if (actieveMemory.length > 0) {
        const regels = actieveMemory
          .slice(0, 5) // maximaal 5, al gesorteerd op confidence (hoog eerst)
          .map((m: { insight: string; confidence: number; knowledge_type: string }) =>
            `- ${m.insight} (${m.knowledge_type === 'hard' ? 'gemeten feit' : `vertrouwen ${m.confidence}%`})`
          )
        memoryContext = `\nBevestigde kennis over deze atleet (opgebouwd over meerdere trainingen, niet zomaar een eenmalige indruk):\n${regels.join('\n')}\nGebruik dit als achtergrondkennis, niet als nieuw te herhalen conclusie.`
      }
    } catch (memErr) {
      console.error('[specialists/cycling/coach] Memory ophalen mislukt, prompt gaat door zonder:', memErr)
    }

    // ── v2.4.86: Goal Engine — vervangt de eerdere, lichte doelen-fetch.
    // Haalt zowel global-doelen (Master Coach-niveau, bijv. "afvallen")
    // als specialist-specifieke doelen (bijv. FTP-target) op, elk met
    // deterministisch berekende dagen-tot-deadline en waarde-kloof.
    const [goalProgress, profielRes] = await Promise.all([
      haalGoalsMetProgress(user.id, 'cycling').catch(err => {
        console.error('[specialists/cycling/coach] Goal Engine mislukt, prompt gaat door zonder:', err)
        return []
      }),
      supabase.from('specialist_profiles').select('preferences').eq('user_id', user.id).eq('specialist_type', 'cycling').single(),
    ])
    const voorkeuren = profielRes.data?.preferences || {}

    const { resultaat, reden } = engineResultaat

    const doelenContext = goalProgress.length > 0
      ? `\nActieve doelen van de gebruiker (${goalProgress.length}, urgentie + Goal Engine-berekening erbij):\n${goalProgress.map(g => {
          const scope = g.goal_scope === 'global' ? 'algemeen' : 'specifiek voor deze sport'
          const kloof = g.waarde_kloof !== null ? `, nog ${Math.abs(g.waarde_kloof)} te overbruggen` : ''
          const deadline = g.dagen_resterend !== null ? `, ${g.dagen_resterend >= 0 ? `nog ${g.dagen_resterend} dagen` : 'deadline verstreken'}` : ''
          return `- ${g.title} [${scope}, urgentie: ${g.urgency}]${kloof}${deadline}`
        }).join('\n')}`
      : '\nGeen actieve doelen ingesteld.'

    // v2.4.79: CoachPolicy als HARDE grenzen in de prompt — geen ruwe
    // hersteldata, alleen het beleid dat eruit volgt (zie
    // specialist-coach-policy.md: "beleid, geen ruwe data")
    const policyContext = `
COACH POLICY (bepaald door de Master Coach, GEEN AI-beslissing — dit zijn
harde grenzen, geen suggesties):
- Maximale intensiteit vandaag: ${policy.maxIntensity}
- Volume-aanpassing: ${policy.volumeAdjustmentPct === 0 ? 'geen aanpassing' : `${policy.volumeAdjustmentPct}%`}
- Prioriteit: ${policy.priority}
- Toegestane type training: ${policy.allowedTrainingTypes.join(', ')}
- VERBODEN type training: ${policy.forbiddenTrainingTypes.length > 0 ? policy.forbiddenTrainingTypes.join(', ') : 'geen'}
Reden: ${policy.reasons.join('; ')}

BELANGRIJK: je advies mag NOOIT een verboden trainingstype aanraden, ongeacht
wat de cijfers hieronder suggereren. Als de data een intensieve training
logisch zou maken maar de policy dat verbiedt, leg dat uit aan de gebruiker
in plaats van de policy te negeren.`

    const systemPrompt = `${COACH_CORE_IDENTITY}
${getCoachTone(2)}
${CORE_SAFETY_RULE}

Je bent nu specifiek de Cycling Coach — een specialistische kennislaag
bovenop jezelf, met diepe fietskennis. Je bent GEEN aparte coach met een
andere stem — dezelfde persoonlijkheid als hierboven, alleen met extra
vakkennis over wielrennen.

BELANGRIJK: onderstaande cijfers zijn AL BEREKEND door een deterministische
Analysis Engine (geen AI). Jij rekent zelf NIETS opnieuw uit, verzin geen
eigen getallen — je interpreteert uitsluitend wat deze cijfers betekenen
voor deze atleet.

CIJFERS (laatste ${periodDays} dagen):
- Trainingsfrequentie: ${resultaat.trainingsfrequentie.aantal_deze_periode} activiteiten (vorige periode: ${resultaat.trainingsfrequentie.aantal_vorige_periode}), trend: ${resultaat.trainingsfrequentie.trend}
- Vermogen: ${resultaat.vermogen.gemiddeld_watt ? `gemiddeld ${resultaat.vermogen.gemiddeld_watt}W` : 'geen vermogensdata'}${resultaat.vermogen.max_watt ? `, max ${resultaat.vermogen.max_watt}W` : ''}${resultaat.vermogen.trend_pct !== null ? `, trend ${resultaat.vermogen.trend_pct > 0 ? '+' : ''}${resultaat.vermogen.trend_pct}%` : ''}
- Afstand: ${resultaat.afstand.totaal_km}km totaal${resultaat.afstand.gemiddeld_km_per_activiteit ? `, gemiddeld ${resultaat.afstand.gemiddeld_km_per_activiteit}km per rit` : ''}
- Trainingsbelasting: ${resultaat.trainingsbelasting.totale_minuten} minuten totaal, score "${resultaat.trainingsbelasting.score}"

TOELICHTING BIJ DE CIJFERS (van de Analysis Engine, ter referentie):
${reden.join('\n')}
${policyContext}
${doelenContext}
${memoryContext}

Geef een persoonlijk, motiverend maar eerlijk cycling-advies. Schrijf in
het Nederlands. Wees concreet — gebruik de cijfers, verzin niets.
Respecteer altijd de Coach Policy hierboven — dit zijn harde grenzen.

KANDIDAAT-INZICHTEN (v2.4.75, optioneel): als je in de cijfers of context
een duurzaam patroon herkent (geen eenmalige observatie, maar iets wat
zich lijkt te herhalen), mag je dat voorstellen als kandidaat-inzicht.
BELANGRIJK: dit is een VOORSTEL, geen vastgestelde waarheid — een
losstaand systeem (de Learning Engine) beslist of dit vaak genoeg
terugkomt om echt te worden vastgelegd. Wees daarom terughoudend: geef
maximaal 2 kandidaten, alleen als je een echt patroon ziet, nooit puur
om het veld te vullen. Elke kandidaat hoort bij één van deze drie
categorieën: "training_response" (hoe reageert het lichaam op een type
training), "preference" (waar de gebruiker blijkbaar naar neigt),
"risk_pattern" (een patroon dat aandacht verdient, bijv. overbelasting).
Geef gewoon een lege array als je niets duurzaams ziet — dat is de
normale, verwachte situatie bij weinig data.

SPECIALIST SUMMARY (v2.4.79, verplicht): vul ook een korte, gestructureerde
samenvatting in — dit is wat de Master Coach straks leest, dus geen lopende
tekst maar exact deze velden. "load": hoe zwaar was de trainingsbelasting
(low/moderate/high, gebaseerd op de cijfers hierboven). "progress":
verbetert/stabiel/verslechtert het (gebaseerd op de trends). "risk": geen/
licht/verhoogd risico (bijv. bij overbelasting-signalen). "recommendation":
één zin, het kernadvies. "confidence": 0-100, hoe zeker ben je van deze
inschatting gegeven de hoeveelheid data.

Reageer ALLEEN in dit JSON-formaat. Let op: "specialist_summary" staat
BEWUST eerst — vul dat als eerste in, zodat het compleet is ook als de
rest van je antwoord onverhoopt wordt afgekapt:
{
  "specialist_summary": {
    "load": "moderate",
    "progress": "stable",
    "risk": "none",
    "recommendation": "korte kernboodschap voor de Master Coach",
    "confidence": 70
  },
  "samenvatting": "1-2 zinnen, de kern van waar deze atleet nu staat qua fietsen",
  "sterke_punten": "2-3 zinnen over wat goed gaat",
  "aandachtspunten": "2-3 zinnen over wat aandacht verdient",
  "advies": "2-3 zinnen concreet advies voor de komende periode",
  "kandidaat_inzichten": [
    { "category": "training_response", "insight": "korte, concrete inzin" }
  ]
}`

    let advies: CyclingCoachAdvies = {
      samenvatting: 'Nog onvoldoende data voor een cycling-samenvatting.',
      sterke_punten: 'Nog geen trend zichtbaar.',
      aandachtspunten: 'Blijf activiteiten importeren voor een vollediger beeld.',
      advies: 'Ga door met fietsen en importeer je ritten — over een paar weken kan de coach een beter beeld geven.',
      generated_at: new Date().toISOString(),
    }
    // v2.4.75: kandidaat-inzichten apart bijgehouden, alleen voor
    // logging/testdoeleinden in de response — worden NIET in het
    // opgeslagen advies (specialist_analyses.analysis) meegenomen
    let leerResultaten: Array<{ category: string; insight: string; actie: string; status: string }> = []
    // v2.4.79: SpecialistSummary — null totdat de AI 'm daadwerkelijk
    // invult (kan mislukken/ontbreken, dan blijft dit null, geen crash)
    let specialistSummary: SpecialistSummary | null = null

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200, // v2.4.81: was 800 — te krap sinds v2.4.79 het JSON-schema uitbreidde met kandidaat_inzichten + specialist_summary, resulteerde in afgekapte responses (specialist_summary bleef null)
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Geef je Cycling Coach-advies.' }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          const kandidaten: KandidaatInzichtRuw[] = Array.isArray(parsed.kandidaat_inzichten) ? parsed.kandidaat_inzichten : []
          // v2.4.79: specialist_summary ook eruit halen, apart bewaren —
          // niet onderdeel van het opgeslagen advies (CyclingCoachAdvies)
          const ruweSummary = parsed.specialist_summary
          delete parsed.kandidaat_inzichten
          delete parsed.specialist_summary
          advies = { ...advies, ...parsed, generated_at: new Date().toISOString() }

          if (ruweSummary && typeof ruweSummary === 'object') {
            specialistSummary = {
              specialist: 'cycling',
              load: ['low', 'moderate', 'high'].includes(ruweSummary.load) ? ruweSummary.load : 'moderate',
              progress: ['improving', 'stable', 'declining'].includes(ruweSummary.progress) ? ruweSummary.progress : 'stable',
              risk: ['none', 'low', 'high'].includes(ruweSummary.risk) ? ruweSummary.risk : 'none',
              recommendation: typeof ruweSummary.recommendation === 'string' ? ruweSummary.recommendation : advies.advies,
              confidence: typeof ruweSummary.confidence === 'number' ? Math.max(0, Math.min(100, ruweSummary.confidence)) : 50,
              reasons: policy.reasons,
            }
          }

          // ── Elke kandidaat door de Learning Engine ────────────────
          // Geldige category vereist, insight-tekst niet leeg — anders
          // negeren i.p.v. de hele call te laten falen (AI-output is
          // nooit 100% gegarandeerd correct gevormd)
          const GELDIGE_CATEGORIEEN = ['training_response', 'preference', 'risk_pattern']
          for (const kandidaat of kandidaten.slice(0, 2)) {
            if (!GELDIGE_CATEGORIEEN.includes(kandidaat.category) || !kandidaat.insight?.trim()) continue
            try {
              const resultaat = await verwerkKandidaatInzicht(user.id, {
                specialist_type: 'cycling',
                knowledge_type: 'soft', // AI-voorgestelde inzichten zijn altijd soft, nooit hard (zie specialist-memory.md)
                insight: kandidaat.insight.trim(),
                category: kandidaat.category,
              })
              leerResultaten.push({ category: kandidaat.category, insight: kandidaat.insight, actie: resultaat.actie, status: resultaat.status })
            } catch (leerErr) {
              console.error('[specialists/cycling/coach] Learning Engine-verwerking mislukt:', leerErr)
            }
          }
        }
      }
    } catch (aiErr) {
      console.error('[specialists/cycling/coach] AI-call mislukt, fallback gebruikt:', aiErr)
    }

    const { data: saved, error: saveError } = await supabase
      .from('specialist_analyses')
      .insert({
        user_id: user.id,
        specialist_type: 'cycling',
        period_days: periodDays,
        analysis: advies,
        generated_at: new Date().toISOString(),
        // v2.4.80: nu wél opgeslagen — rechtzetting op v2.4.79, waar dit
        // bewust alleen in de API-response stond. De Master Coach kan
        // dit anders nergens lezen. Zie supabase/specialist_summary_kolom.sql
        specialist_summary: specialistSummary,
      })
      .select()
      .single()

    if (saveError) throw saveError

    // v2.4.75: leerResultaten wordt NIET opgeslagen in specialist_analyses
    // (dat blijft precies CyclingCoachAdvies) — alleen in de API-response
    // meegegeven, zodat sub-stap 3 testbaar is zonder een aparte query
    // v2.4.79: specialist_summary en de gebruikte coach_policy worden NIET
    // opgeslagen in specialist_analyses (dat blijft exact CyclingCoachAdvies)
    // — alleen in de API-response, voor testbaarheid en straks voor de
    // Master Coach om te lezen (nog te bouwen, aparte stap)
    // v2.4.80: specialist_summary zit nu al in 'saved' (opgeslagen kolom),
    // geen losse toevoeging meer nodig — coach_policy_gebruikt blijft
    // response-only (bewust niet opgeslagen, is per-call context, geen
    // duurzame data)
    return NextResponse.json({ ...saved, leer_resultaten: leerResultaten, coach_policy_gebruikt: policy })
  } catch (err) {
    console.error('[specialists/cycling/coach]', err)
    return NextResponse.json({ error: 'Advies genereren mislukt' }, { status: 500 })
  }
}
