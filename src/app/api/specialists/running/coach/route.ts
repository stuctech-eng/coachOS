export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { analyseerRunning } from '@/lib/specialists/running-analysis'
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

export interface RunningCoachAdvies {
  samenvatting: string
  sterke_punten: string
  aandachtspunten: string
  advies: string
  generated_at: string
}

interface KandidaatInzichtRuw {
  category: 'training_response' | 'preference' | 'risk_pattern'
  insight: string
}

interface SpecialistSummary {
  specialist: 'running'
  load: 'low' | 'moderate' | 'high'
  progress: 'improving' | 'stable' | 'declining'
  risk: 'none' | 'low' | 'high'
  recommendation: string
  confidence: number
  reasons: string[]
}

// ── Fase 3 — Running Coach Layer ────────────────────────────────────────
// v2.4.83: TWEEDE SPECIALIST — exact spiegelbeeld van
// cycling/coach/route.ts. Bevestigt de "invuloefening"-belofte uit
// specialist-engine-architecture.md: genereerCoachPolicy(),
// verwerkKandidaatInzicht(), haalMemoryOp() zijn ALLEMAAL rechtstreeks
// hergebruikt, GEEN wijziging nodig — alleen de Data/Analysis-laag
// (running-data.ts, running-analysis.ts) en de prompt-tekst zijn
// sport-specifiek. Enige inhoudelijke verschil: "snelheid" i.p.v.
// "vermogen" (running heeft doorgaans geen vermogensmeter).

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json(null)
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('specialist_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('specialist_type', 'running')
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

    const gisteren = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from('specialist_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('specialist_type', 'running')
      .gte('generated_at', gisteren)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.analysis) return NextResponse.json(cached)

    const engineResultaat = await analyseerRunning(user.id, periodDays)

    // genereerCoachPolicy is volledig sport-onafhankelijk — geen wijziging nodig
    const policy = await genereerCoachPolicy(user.id)

    let memoryContext = ''
    try {
      const actieveMemory = await haalMemoryOp(user.id, 'running', true)
      if (actieveMemory.length > 0) {
        const regels = actieveMemory
          .slice(0, 5)
          .map((m: { insight: string; confidence: number; knowledge_type: string }) =>
            `- ${m.insight} (${m.knowledge_type === 'hard' ? 'gemeten feit' : `vertrouwen ${m.confidence}%`})`
          )
        memoryContext = `\nBevestigde kennis over deze atleet (opgebouwd over meerdere trainingen, niet zomaar een eenmalige indruk):\n${regels.join('\n')}\nGebruik dit als achtergrondkennis, niet als nieuw te herhalen conclusie.`
      }
    } catch (memErr) {
      console.error('[specialists/running/coach] Memory ophalen mislukt, prompt gaat door zonder:', memErr)
    }

    // ── v2.4.86: Goal Engine — vervangt de eerdere, lichte doelen-fetch.
    // Haalt zowel global-doelen (Master Coach-niveau, bijv. "afvallen")
    // als specialist-specifieke doelen (bijv. FTP-target) op, elk met
    // deterministisch berekende dagen-tot-deadline en waarde-kloof.
    const [goalProgress, profielRes] = await Promise.all([
      haalGoalsMetProgress(user.id, 'running').catch(err => {
        console.error('[specialists/running/coach] Goal Engine mislukt, prompt gaat door zonder:', err)
        return []
      }),
      supabase.from('specialist_profiles').select('preferences').eq('user_id', user.id).eq('specialist_type', 'running').single(),
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

Je bent nu specifiek de Running Coach — een specialistische kennislaag
bovenop jezelf, met diepe hardloopkennis. Je bent GEEN aparte coach met een
andere stem — dezelfde persoonlijkheid als hierboven, alleen met extra
vakkennis over hardlopen.

BELANGRIJK: onderstaande cijfers zijn AL BEREKEND door een deterministische
Analysis Engine (geen AI). Jij rekent zelf NIETS opnieuw uit, verzin geen
eigen getallen — je interpreteert uitsluitend wat deze cijfers betekenen
voor deze atleet.

CIJFERS (laatste ${periodDays} dagen):
- Trainingsfrequentie: ${resultaat.trainingsfrequentie.aantal_deze_periode} activiteiten (vorige periode: ${resultaat.trainingsfrequentie.aantal_vorige_periode}), trend: ${resultaat.trainingsfrequentie.trend}
- Snelheid: ${resultaat.snelheid.gemiddelde_snelheid ? `gemiddeld ${resultaat.snelheid.gemiddelde_snelheid}` : 'geen snelheidsdata'}${resultaat.snelheid.max_snelheid ? `, max ${resultaat.snelheid.max_snelheid}` : ''}${resultaat.snelheid.trend_pct !== null ? `, trend ${resultaat.snelheid.trend_pct > 0 ? '+' : ''}${resultaat.snelheid.trend_pct}%` : ''}
- Afstand: ${resultaat.afstand.totaal_km}km totaal${resultaat.afstand.gemiddeld_km_per_activiteit ? `, gemiddeld ${resultaat.afstand.gemiddeld_km_per_activiteit}km per run` : ''}
- Trainingsbelasting: ${resultaat.trainingsbelasting.totale_minuten} minuten totaal, score "${resultaat.trainingsbelasting.score}"

TOELICHTING BIJ DE CIJFERS (van de Analysis Engine, ter referentie):
${reden.join('\n')}
${policyContext}
${doelenContext}
${memoryContext}

Geef een persoonlijk, motiverend maar eerlijk hardloop-advies. Schrijf in
het Nederlands. Wees concreet — gebruik de cijfers, verzin niets.
Respecteer altijd de Coach Policy hierboven — dit zijn harde grenzen.

KANDIDAAT-INZICHTEN (optioneel): als je in de cijfers of context een
duurzaam patroon herkent (geen eenmalige observatie, maar iets wat zich
lijkt te herhalen), mag je dat voorstellen als kandidaat-inzicht. BELANGRIJK:
dit is een VOORSTEL, geen vastgestelde waarheid — een losstaand systeem (de
Learning Engine) beslist of dit vaak genoeg terugkomt om echt te worden
vastgelegd. Wees daarom terughoudend: geef maximaal 2 kandidaten, alleen als
je een echt patroon ziet, nooit puur om het veld te vullen. Elke kandidaat
hoort bij één van deze drie categorieën: "training_response" (hoe reageert
het lichaam op een type training), "preference" (waar de gebruiker
blijkbaar naar neigt), "risk_pattern" (een patroon dat aandacht verdient,
bijv. overbelasting). Geef gewoon een lege array als je niets duurzaams
ziet — dat is de normale, verwachte situatie bij weinig data.

SPECIALIST SUMMARY (verplicht): vul ook een korte, gestructureerde
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
  "samenvatting": "1-2 zinnen, de kern van waar deze atleet nu staat qua hardlopen",
  "sterke_punten": "2-3 zinnen over wat goed gaat",
  "aandachtspunten": "2-3 zinnen over wat aandacht verdient",
  "advies": "2-3 zinnen concreet advies voor de komende periode",
  "kandidaat_inzichten": [
    { "category": "training_response", "insight": "korte, concrete inzin" }
  ]
}`

    let advies: RunningCoachAdvies = {
      samenvatting: 'Nog onvoldoende data voor een hardloop-samenvatting.',
      sterke_punten: 'Nog geen trend zichtbaar.',
      aandachtspunten: 'Blijf activiteiten importeren voor een vollediger beeld.',
      advies: 'Ga door met hardlopen en importeer je runs — over een paar weken kan de coach een beter beeld geven.',
      generated_at: new Date().toISOString(),
    }
    let leerResultaten: Array<{ category: string; insight: string; actie: string; status: string }> = []
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
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Geef je Running Coach-advies.' }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const rawText = aiData.content?.[0]?.text || ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          const kandidaten: KandidaatInzichtRuw[] = Array.isArray(parsed.kandidaat_inzichten) ? parsed.kandidaat_inzichten : []
          const ruweSummary = parsed.specialist_summary
          delete parsed.kandidaat_inzichten
          delete parsed.specialist_summary
          advies = { ...advies, ...parsed, generated_at: new Date().toISOString() }

          if (ruweSummary && typeof ruweSummary === 'object') {
            specialistSummary = {
              specialist: 'running',
              load: ['low', 'moderate', 'high'].includes(ruweSummary.load) ? ruweSummary.load : 'moderate',
              progress: ['improving', 'stable', 'declining'].includes(ruweSummary.progress) ? ruweSummary.progress : 'stable',
              risk: ['none', 'low', 'high'].includes(ruweSummary.risk) ? ruweSummary.risk : 'none',
              recommendation: typeof ruweSummary.recommendation === 'string' ? ruweSummary.recommendation : advies.advies,
              confidence: typeof ruweSummary.confidence === 'number' ? Math.max(0, Math.min(100, ruweSummary.confidence)) : 50,
              reasons: policy.reasons,
            }
          }

          const GELDIGE_CATEGORIEEN = ['training_response', 'preference', 'risk_pattern']
          for (const kandidaat of kandidaten.slice(0, 2)) {
            if (!GELDIGE_CATEGORIEEN.includes(kandidaat.category) || !kandidaat.insight?.trim()) continue
            try {
              const resultaat2 = await verwerkKandidaatInzicht(user.id, {
                specialist_type: 'running',
                knowledge_type: 'soft',
                insight: kandidaat.insight.trim(),
                category: kandidaat.category,
              })
              leerResultaten.push({ category: kandidaat.category, insight: kandidaat.insight, actie: resultaat2.actie, status: resultaat2.status })
            } catch (leerErr) {
              console.error('[specialists/running/coach] Learning Engine-verwerking mislukt:', leerErr)
            }
          }
        }
      }
    } catch (aiErr) {
      console.error('[specialists/running/coach] AI-call mislukt, fallback gebruikt:', aiErr)
    }

    const { data: saved, error: saveError } = await supabase
      .from('specialist_analyses')
      .insert({
        user_id: user.id,
        specialist_type: 'running',
        period_days: periodDays,
        analysis: advies,
        generated_at: new Date().toISOString(),
        specialist_summary: specialistSummary,
      })
      .select()
      .single()

    if (saveError) throw saveError

    return NextResponse.json({ ...saved, leer_resultaten: leerResultaten, coach_policy_gebruikt: policy })
  } catch (err) {
    console.error('[specialists/running/coach]', err)
    return NextResponse.json({ error: 'Advies genereren mislukt' }, { status: 500 })
  }
}
