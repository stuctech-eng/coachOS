'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { AppShell } from '@/components/layout'

interface LogItem {
  tekst: string
  status: 'ok' | 'fout' | 'info' | 'warn'
}

// v2.4.13: volledige tabellenlijst — alle 29 tabellen uit het schema.
// Elke check doet alleen `select id limit 1` (of minimaal veld) puur om
// bereikbaarheid te testen — nooit de inhoud van gevoelige tabellen
// (strava_tokens, health_api_keys) tonen.
const ALLE_TABELLEN = [
  'activities', 'activity_sessions', 'activity_templates', 'ai_conversations',
  'coach_call_items', 'coach_calls', 'coach_insights', 'coach_memory',
  'coach_recommendations', 'daily_checkins', 'daily_status', 'exercise_records',
  'garmin_imports', 'goal_updates', 'health_api_keys', 'health_metrics',
  'injuries', 'injury_updates', 'journal_entries', 'knowledge_observations',
  'life_events', 'profiles', 'progress_analyses', 'recovery_results',
  'recovery_sessions', 'strava_tokens', 'training_results', 'training_sessions',
  'user_goals',
  // v2.4.65: ontbrak — de twee tabellen uit de specialistlaag (SQL v2.4.59)
  'specialist_profiles', 'specialist_analyses',
] as const

// v2.4.13: kern-routes die veilig te testen zijn met GET zonder bijeffecten.
// Routes die alleen POST/schrijfacties ondersteunen (training/complete,
// coach-calls/rate, training/today POST, strava/sync, etc.) worden bewust
// NIET aangeroepen — dat zou echte data aanmaken/wijzigen, wat buiten de
// scope van Laag 1+2 valt (puur lees-gezondheidscheck).
const KERN_ROUTES_GET = [
  '/api/checkin',
  '/api/status',
  '/api/coach',
  '/api/coach-calls',
  '/api/training/today',
  '/api/weather',
  '/api/activities',
  '/api/goals',
  '/api/injuries',
  '/api/life-events',
  '/api/compliance',
  '/api/trends',
  '/api/performance',
  '/api/predictions',
  '/api/profile',
  '/api/equipment',
  '/api/weekly',
  '/api/specialists', // v2.4.65: specialistlaag Fase 1
] as const

export default function DebugPage() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [bezig, setBezig] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wiped, setWiped] = useState(false)

  // v2.4.65: interactieve specialistlaag-tests — hergebruikt van de
  // verwijderde, losse /debug/specialists-pagina. Die pagina gebruikte
  // geen AppShell en had daardoor twee losse problemen (geen scroll,
  // en een nooit-volledig-verklaarde paginaherlaad-bug tijdens
  // navigatie). Hier, binnen deze al-werkende, al-ingelogde
  // AppShell-pagina, treden beide problemen niet op.
  const [specialisten, setSpecialisten] = useState<Array<{ specialist_type: string; label: string; beschikbaar: boolean; actief: boolean; activated_at: string | null }>>([])
  const [specialistenBezig, setSpecialistenBezig] = useState(false)
  const [specialistToggleBezig, setSpecialistToggleBezig] = useState<string | null>(null)
  const [specialistResultaat, setSpecialistResultaat] = useState('')
  const [dataLayerBezig, setDataLayerBezig] = useState(false)
  const [dataLayerResultaat, setDataLayerResultaat] = useState('')
  // v2.4.66: test-state voor Fase 2b (Cycling Analysis Engine)
  const [engineBezig, setEngineBezig] = useState(false)
  const [engineResultaat, setEngineResultaat] = useState('')
  // v2.4.67: test-state voor Fase 3 (Coach Layer, AI)
  const [coachBezig, setCoachBezig] = useState(false)
  const [coachResultaat, setCoachResultaat] = useState('')
  // v2.4.74: test-state voor Memory Engine, sub-stap 2 (Learning Engine)
  const [memoryBezig, setMemoryBezig] = useState(false)
  const [memoryResultaat, setMemoryResultaat] = useState('')
  // v2.4.85: test-state voor de Decision Engine
  const [decisionBezig, setDecisionBezig] = useState(false)
  const [decisionResultaat, setDecisionResultaat] = useState('')
  // v2.4.96: test-state voor de Adaptive Training Plan Engine
  const [planBezig, setPlanBezig] = useState(false)
  const [planResultaat, setPlanResultaat] = useState('')
  // v2.4.97: test-state voor de Coach-uitleglaag (Fase 2)
  const [uitlegBezig, setUitlegBezig] = useState(false)
  const [uitlegResultaat, setUitlegResultaat] = useState('')
  const [testInsight, setTestInsight] = useState('Reageert goed op langere duurritten')
  const [testCategory, setTestCategory] = useState('training_response')

  async function laadSpecialisten() {
    setSpecialistenBezig(true)
    try {
      const res = await fetch('/api/specialists', { credentials: 'include' })
      const data = await res.json()
      setSpecialistResultaat(`GET /api/specialists →\n${JSON.stringify(data, null, 2)}`)
      setSpecialisten(data.specialisten || [])
    } catch (e) {
      setSpecialistResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setSpecialistenBezig(false)
    }
  }

  async function toggleSpecialist(type: string, huidigeStatus: boolean) {
    setSpecialistToggleBezig(type)
    try {
      const res = await fetch('/api/specialists', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialist_type: type, active: !huidigeStatus }),
      })
      const data = await res.json()
      setSpecialistResultaat(`POST /api/specialists (${type}, active: ${!huidigeStatus}) →\n${JSON.stringify(data, null, 2)}`)
      await laadSpecialisten()
    } catch (e) {
      setSpecialistResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setSpecialistToggleBezig(null)
    }
  }

  async function testDataLayer() {
    setDataLayerBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/data?period_days=90', { credentials: 'include' })
      const data = await res.json()
      setDataLayerResultaat(`GET /api/specialists/cycling/data?period_days=90 →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setDataLayerResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setDataLayerBezig(false)
    }
  }

  // v2.4.66: test-functie voor Fase 2b (Cycling Analysis Engine)
  async function testEngine() {
    setEngineBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/engine?period_days=90', { credentials: 'include' })
      const data = await res.json()
      setEngineResultaat(`GET /api/specialists/cycling/engine?period_days=90 →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setEngineResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setEngineBezig(false)
    }
  }

  // v2.4.67: test-functie voor Fase 3 (Coach Layer, AI) — POST, want dit
  // genereert daadwerkelijk een nieuw AI-advies (of geeft cache terug)
  async function testCoach() {
    setCoachBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/coach', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_days: 90 }),
      })
      const data = await res.json()
      setCoachResultaat(`POST /api/specialists/cycling/coach →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setCoachResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setCoachBezig(false)
    }
  }

  // v2.4.74: test-functies voor Memory Engine, sub-stap 2 (Learning Engine)
  async function laadMemory() {
    setMemoryBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/memory', { credentials: 'include' })
      const data = await res.json()
      setMemoryResultaat(`GET /api/specialists/cycling/memory →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setMemoryResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setMemoryBezig(false)
    }
  }

  async function dienKandidaatIn() {
    setMemoryBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/memory', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight: testInsight, category: testCategory, knowledge_type: 'soft' }),
      })
      const data = await res.json()
      setMemoryResultaat(`POST /api/specialists/cycling/memory →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setMemoryResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setMemoryBezig(false)
    }
  }

  // v2.4.85: test-functie voor de Decision Engine — gebruikt echte,
  // actuele data van je actieve specialisten
  async function testDecisionEngine() {
    setDecisionBezig(true)
    try {
      const res = await fetch('/api/specialists/decision-test', { credentials: 'include' })
      const data = await res.json()
      setDecisionResultaat(`GET /api/specialists/decision-test →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setDecisionResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setDecisionBezig(false)
    }
  }

  // v2.4.96: test-functies voor de Adaptive Training Plan Engine
  async function genereerPlan() {
    setPlanBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/training-plan', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setPlanResultaat(`POST /api/specialists/cycling/training-plan →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setPlanResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setPlanBezig(false)
    }
  }

  async function haalPlanOp() {
    setPlanBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/training-plan', { credentials: 'include' })
      const data = await res.json()
      setPlanResultaat(`GET /api/specialists/cycling/training-plan →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setPlanResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setPlanBezig(false)
    }
  }

  // v2.4.97: test-functie voor de Coach-uitleglaag (Fase 2)
  async function haalUitlegOp() {
    setUitlegBezig(true)
    try {
      const res = await fetch('/api/specialists/cycling/training-plan/explain', { credentials: 'include' })
      const data = await res.json()
      setUitlegResultaat(`GET /api/specialists/cycling/training-plan/explain →\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      setUitlegResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setUitlegBezig(false)
    }
  }

  const log = (tekst: string, status: LogItem['status'] = 'info') => {
    setLogs(prev => [...prev, { tekst: `${new Date().toLocaleTimeString('nl-NL')} ${tekst}`, status }])
  }

  const runDiagnostiek = async () => {
    setLogs([])
    setBezig(true)

    try {
      // 1. Environment variables
      log('── ENVIRONMENT ──', 'info')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      const appUrl = process.env.NEXT_PUBLIC_APP_URL

      log(`Supabase URL: ${supabaseUrl ? supabaseUrl.slice(0, 30) + '...' : 'ONTBREEKT'}`,
        supabaseUrl ? 'ok' : 'fout')
      log(`Supabase Key: ${supabaseKey ? supabaseKey.slice(0, 20) + '...' : 'ONTBREEKT'}`,
        supabaseKey ? 'ok' : 'fout')
      log(`App URL: ${appUrl || 'ONTBREEKT'}`, appUrl ? 'ok' : 'warn')

      // 2. Supabase auth
      log('── SUPABASE AUTH ──', 'info')
      const supabase = createBrowserClient(supabaseUrl!, supabaseKey!)

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        log(`Auth sessie FOUT: ${sessionError.message}`, 'fout')
      } else if (sessionData.session) {
        log(`Auth sessie: actief (${sessionData.session.user.email})`, 'ok')
        log(`User ID: ${sessionData.session.user.id.slice(0, 8)}...`, 'ok')
      } else {
        log('Auth sessie: geen sessie (niet ingelogd)', 'warn')
      }

      // ── LAAG 1: ALLE TABELLEN — bereikbaarheid ───────────────────────────
      // v2.4.13: uitgebreid van 4 naar alle 29 tabellen uit het schema.
      // Puur lezend: `select id limit 1`. Toont nooit inhoud van gevoelige
      // tabellen (strava_tokens, health_api_keys) — alleen bereikbaar/niet.
      log('── LAAG 1: DATABASE — ALLE TABELLEN ──', 'info')
      let tabellenOk = 0
      let tabellenFout = 0
      for (const tabel of ALLE_TABELLEN) {
        try {
          const { error: tabelError } = await supabase
            .from(tabel)
            .select('id')
            .limit(1)
          if (tabelError) {
            log(`${tabel}: FOUT — ${tabelError.message}`, 'fout')
            tabellenFout++
          } else {
            tabellenOk++
          }
        } catch (e) {
          log(`${tabel}: FOUT — ${(e as Error).message}`, 'fout')
          tabellenFout++
        }
      }
      log(`Tabellen bereikbaar: ${tabellenOk}/${ALLE_TABELLEN.length}${tabellenFout > 0 ? ` — ${tabellenFout} FOUT (zie hierboven)` : ''}`,
        tabellenFout === 0 ? 'ok' : 'fout')

      // ── LAAG 2: KERN API-ROUTES ───────────────────────────────────────────
      // v2.4.13: uitgebreid van 2 naar alle veilig-te-testen (GET, geen
      // bijeffecten) kernroutes. Schrijfroutes (POST training/complete,
      // coach-calls/rate, strava/sync, etc.) worden bewust NIET aangeroepen.
      log('── LAAG 2: API ROUTES ──', 'info')
      let routesOk = 0
      let routesFout = 0
      for (const route of KERN_ROUTES_GET) {
        try {
          const res = await fetch(route, { method: 'GET', credentials: 'include' })
          // 401 (niet ingelogd voor deze check) en 404 (route bestaat niet
          // meer) worden als fout gerekend; overige 2xx/3xx als ok, want
          // sommige routes geven bewust null/leeg terug zonder body-data
          if (res.ok || res.status === 304) {
            log(`${route}: ${res.status} OK`, 'ok')
            routesOk++
          } else {
            log(`${route}: ${res.status} FOUT`, 'fout')
            routesFout++
          }
        } catch (e) {
          log(`${route}: FOUT — ${(e as Error).message}`, 'fout')
          routesFout++
        }
      }
      log(`Routes bereikbaar: ${routesOk}/${KERN_ROUTES_GET.length}${routesFout > 0 ? ` — ${routesFout} FOUT (zie hierboven)` : ''}`,
        routesFout === 0 ? 'ok' : 'fout')

      // 5. Anthropic API
      log('── ANTHROPIC API ──', 'info')
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Zeg alleen: OK' }],
          }),
          credentials: 'include',
        })
        const data = await res.json()
        if (res.ok && data.content?.[0]?.text) {
          log(`Anthropic API: bereikbaar (${data.content[0].text.trim()})`, 'ok')
        } else if (data.error) {
          log(`Anthropic API FOUT: ${data.error}`, 'fout')
        } else {
          log(`Anthropic API: status ${res.status}`, res.ok ? 'ok' : 'fout')
        }
      } catch (e) {
        log(`Anthropic API FOUT: ${(e as Error).message}`, 'fout')
      }

      // 6. PWA status
      log('── PWA ──', 'info')
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      log(`PWA modus: ${isStandalone ? 'standalone (beginscherm)' : 'browser'}`,
        isStandalone ? 'ok' : 'warn')
      log(`Platform: ${navigator.userAgent.includes('iPhone') ? 'iPhone' : navigator.userAgent.includes('iPad') ? 'iPad' : 'Anders'}`, 'info')

      // 7. Vandaag data
      log('── VANDAAG ──', 'info')
      const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
      log(`Datum (Amsterdam): ${vandaag}`, 'info')

      const { data: checkinVandaag } = await supabase
        .from('daily_checkins')
        .select('id, feeling_score, energy_score')
        .eq('date', vandaag)
        .single()
      log(`Check-in vandaag: ${checkinVandaag ? `gevoel ${checkinVandaag.feeling_score}, energie ${checkinVandaag.energy_score}` : 'nog niet gedaan'}`,
        checkinVandaag ? 'ok' : 'warn')

      const { data: garminVandaag } = await supabase
        .from('garmin_imports')
        .select('date, status')
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
        .limit(1)
        .single()
      log(`Garmin laatste import: ${garminVandaag ? garminVandaag.date : 'geen'}`,
        garminVandaag?.date === vandaag ? 'ok' : 'warn')

      const { data: coachVandaag } = await supabase
        .from('coach_recommendations')
        .select('actie_type, trainer_instructies')
        .eq('date', vandaag)
        .eq('type', 'coach')
        .single()
      log(`Coach advies vandaag: ${coachVandaag ? coachVandaag.actie_type : 'nog niet gegenereerd'}`,
        coachVandaag ? 'ok' : 'warn')
      if (coachVandaag?.trainer_instructies) {
        log(`Trainer instructies: ${coachVandaag.trainer_instructies.slice(0, 60)}...`, 'info')
      }

      // Training sessie localStorage check — bron van client-side crashes
      log('── TRAINING SESSIE (localStorage) ──', 'info')
      try {
        const keys = [
          'coachos_session', 'coachos_training_session',
          'training_instructie_data', 'training_instructie_datum',
          'dagplan_data', 'dagplan_datum',
        ]
        let gevondenIets = false
        for (const key of keys) {
          const raw = window.localStorage.getItem(key)
          if (raw) {
            gevondenIets = true
            try {
              const parsed = JSON.parse(raw)
              const keys2 = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).join(', ') : typeof parsed
              log(`${key}: aanwezig (${raw.length} chars) — velden: ${keys2}`, 'info')
            } catch {
              // Kale datumstrings (bv. "2026-07-03") zijn geen geldige JSON
              // maar ook geen fout — dat is verwacht gedrag voor *_datum keys
              if (key.endsWith('_datum')) {
                log(`${key}: aanwezig (datumwaarde, geen JSON — verwacht)`, 'info')
              } else {
                log(`${key}: aanwezig maar GEEN geldige JSON (${raw.slice(0, 40)}...)`, 'fout')
              }
            }
          }
        }
        if (!gevondenIets) {
          log('Geen training sessie data in localStorage — schoon', 'ok')
        } else {
          log('Tip: bij rare crashes in training → wis bovenstaande keys hieronder', 'warn')
        }
      } catch (e) {
        log(`localStorage check FOUT: ${(e as Error).message}`, 'fout')
      }

      // ── COACH CALL INTEGRITEIT ────────────────────────────────────────────
      log('── COACH CALL INTEGRITEIT (laatste 24u) ──', 'info')
      try {
        const vanaf = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recenteLibraryTrainingen, error: trErr } = await supabase
          .from('training_results')
          .select('id, training_type, completed_at')
          .eq('user_id', sessionData.session?.user.id || '')
          .eq('training_source', 'library')
          .gte('completed_at', vanaf)
          .order('completed_at', { ascending: false })

        if (trErr) {
          log(`training_results query FOUT: ${trErr.message}`, 'fout')
        } else if (!recenteLibraryTrainingen || recenteLibraryTrainingen.length === 0) {
          log('Geen bibliotheek-trainingen in de laatste 24u — niets te checken', 'info')
        } else {
          log(`${recenteLibraryTrainingen.length} bibliotheek-training(en) gevonden laatste 24u`, 'info')

          const { data: items, error: itemsErr } = await supabase
            .from('coach_call_items')
            .select('training_result_id')
            .in('training_result_id', recenteLibraryTrainingen.map(t => t.id))

          if (itemsErr) {
            log(`coach_call_items query FOUT: ${itemsErr.message}`, 'fout')
          } else {
            const gekoppeldeIds = new Set((items || []).map(i => i.training_result_id))
            const ontbrekend = recenteLibraryTrainingen.filter(t => !gekoppeldeIds.has(t.id))

            if (ontbrekend.length === 0) {
              log('Alle recente bibliotheek-trainingen hebben een Coach Call item — OK', 'ok')
            } else {
              for (const t of ontbrekend) {
                const tijd = t.completed_at ? new Date(t.completed_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : '?'
                log(`ONTBREEKT: ${t.training_type || 'training'} (${tijd}) — geen coach_call_item, training_result_id ${(t.id as string).slice(0, 8)}...`, 'fout')
              }
              log('Tip: dit duidt op een mislukte Stap 3 in training/complete/route.ts. Zie changelog v2.4.8 t/m v2.4.12.', 'warn')
            }
          }
        }
      } catch (e) {
        log(`Coach Call integriteit check FOUT: ${(e as Error).message}`, 'fout')
      }

      // ── LAAG 3: SCHRIJFTEST coach_calls / coach_call_items ────────────────
      // v2.4.13: maakt een tijdelijke, herkenbare testrij aan, controleert
      // of insert/select werkt, en verwijdert hem direct weer (finally-blok
      // garandeert opruiming, ook bij een fout onderweg). Ruimt ook oude
      // testrijen op (ouder dan 5 min) mocht een eerdere run niet zijn
      // opgeruimd door een crash. Dit is de enige schrijvende check — vangt
      // precies het type constraint-fout dat Laag 1 (read-only) niet kan
      // zien, zoals de NOT NULL-bug uit v2.4.12.
      log('── LAAG 3: SCHRIJFTEST coach_calls / coach_call_items ──', 'info')
      const SELFTEST_MARKER = '__SELFTEST__'
      let testCallId: string | null = null
      try {
        const userId = sessionData.session?.user.id
        if (!userId) {
          log('Geen actieve sessie — schrijftest overgeslagen', 'warn')
        } else {
          // Ruim eventuele oude testrijen op (van een gecrashte vorige run)
          const vijfMinGeleden = new Date(Date.now() - 5 * 60 * 1000).toISOString()
          const { data: oudeTests } = await supabase
            .from('coach_call_items')
            .select('id, coach_call_id, sport_type, created_at')
            .eq('sport_type', SELFTEST_MARKER)
            .lt('created_at', vijfMinGeleden)
          if (oudeTests && oudeTests.length > 0) {
            for (const oud of oudeTests) {
              await supabase.from('coach_call_items').delete().eq('id', oud.id)
              await supabase.from('coach_calls').delete().eq('id', oud.coach_call_id).eq('status', '__selftest_pending__')
            }
            log(`${oudeTests.length} oude testrij(en) opgeruimd van eerdere (gecrashte) run`, 'warn')
          }

          // Stap A: tijdelijke coach_calls testrij (eigen status-waarde,
          // nooit gelijk aan een echte status, zodat hij nooit door de
          // normale app-logica als een echte call wordt gezien)
          const testDatum = `1900-01-01` // ver in het verleden — kan nooit met een echte call clashen
          const { data: testCall, error: callErr } = await supabase
            .from('coach_calls')
            .insert({ user_id: userId, date: testDatum, status: '__selftest_pending__' })
            .select('id')
            .single()

          if (callErr) {
            log(`coach_calls schrijftest FOUT: ${callErr.message} (code: ${callErr.code || '?'})`, 'fout')
          } else if (testCall) {
            testCallId = testCall.id
            log('coach_calls: insert OK', 'ok')

            // Stap B: tijdelijke coach_call_items testrij — dit is exact de
            // insert die in v2.4.12 faalde door de NOT NULL constraint
            const { error: itemErr } = await supabase
              .from('coach_call_items')
              .insert({
                coach_call_id: testCallId,
                training_result_id: null,
                activity_session_id: null,
                sport_type: SELFTEST_MARKER,
                duration_min: 0,
                status: '__selftest__',
              })

            if (itemErr) {
              log(`coach_call_items schrijftest FOUT: ${itemErr.message} (code: ${itemErr.code || '?'})`, 'fout')
              log('Tip: dit is exact het type fout dat in v2.4.12 handmatig gevonden moest worden (bv. een NOT NULL constraint). Nu direct zichtbaar.', 'warn')
            } else {
              log('coach_call_items: insert OK (zowel training_result_id als activity_session_id null toegestaan)', 'ok')
            }
          }
        }
      } catch (e) {
        log(`Schrijftest FOUT: ${(e as Error).message}`, 'fout')
      } finally {
        // Opruimen — altijd, ongeacht of de test slaagde of faalde
        if (testCallId) {
          await supabase.from('coach_call_items').delete().eq('coach_call_id', testCallId)
          await supabase.from('coach_calls').delete().eq('id', testCallId)
          log('Testdata opgeruimd', 'info')
        }
      }

      log('── KLAAR ──', 'info')

    } catch (e) {
      log(`Onverwachte fout: ${(e as Error).message}`, 'fout')
    } finally {
      setBezig(false)
    }
  }

  const getKleur = (status: LogItem['status']) => {
    if (status === 'ok') return 'text-green-400'
    if (status === 'fout') return 'text-red-400'
    if (status === 'warn') return 'text-amber-400'
    return 'text-slate-400'
  }

  const getIcon = (status: LogItem['status']) => {
    if (status === 'ok') return '✅'
    if (status === 'fout') return '❌'
    if (status === 'warn') return '⚠️'
    return '   '
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">

        <div>
          <h1 className="text-2xl font-bold text-white">Debug</h1>
          <p className="text-slate-400 text-sm mt-0.5">CoachOS gezondheidscheck — {ALLE_TABELLEN.length} tabellen, {KERN_ROUTES_GET.length} routes, schrijftest coach_calls</p>
        </div>

        {/* v2.4.144: link naar Recovery Debug Dashboard */}
        <a href="/debug/recovery" className="block w-full py-3 rounded-xl text-center text-sm font-medium bg-white/5 text-slate-300 active:bg-white/10">
          🩺 Recovery Debug Dashboard
        </a>

        {/* v2.4.149: link naar Performance Engine Debug (Fase 1A) */}
        <a href="/debug/performance-engine" className="block w-full py-3 rounded-xl text-center text-sm font-medium bg-white/5 text-slate-300 active:bg-white/10">
          ⚙️ Performance Engine Debug (Fase 1A)
        </a>

        <button
          onClick={runDiagnostiek}
          disabled={bezig}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-primary-600 active:bg-primary-700 disabled:opacity-50"
        >
          {bezig ? '⏳ Bezig...' : '▶ Start diagnostiek'}
        </button>

        <div className="bg-slate-900 rounded-2xl p-4 min-h-64 font-mono">
          {logs.length === 0 ? (
            <p className="text-slate-600 text-xs">Druk op Start om te beginnen...</p>
          ) : (
            logs.map((l, i) => (
              <div key={i} className={`text-xs mb-1.5 leading-relaxed break-all ${getKleur(l.status)}`}>
                {l.status !== 'info' ? getIcon(l.status) + ' ' : ''}{l.tekst}
              </div>
            ))
          )}
        </div>

        {logs.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs text-slate-500">
              <span>✅ {logs.filter(l => l.status === 'ok').length} ok</span>
              <span>❌ {logs.filter(l => l.status === 'fout').length} fouten</span>
              <span>⚠️ {logs.filter(l => l.status === 'warn').length} waarschuwingen</span>
            </div>
            <button
              onClick={() => {
                const tekst = logs.map(l => {
                  const icon = l.status === 'ok' ? '✅' : l.status === 'fout' ? '❌' : l.status === 'warn' ? '⚠️' : '  '
                  return `${icon} ${l.tekst}`
                }).join('\n')
                navigator.clipboard.writeText(tekst).catch(() => {})
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 active:bg-slate-700"
            >
              {copied ? '✓ Gekopieerd' : 'Kopieer log'}
            </button>
          </div>
        )}

        {/* v2.4.65: Specialistlaag — interactieve tests (Fase 1 + 2a) */}
        <div className="border-t border-slate-800 pt-4 mt-2">
          <h2 className="text-sm font-bold text-white mb-1">Specialistlaag — Fase 1 + 2a (Cycling-referentie)</h2>
          <p className="text-xs text-slate-500 mb-3">Interactieve tests, los van de algemene diagnostiek hierboven.</p>

          <button onClick={laadSpecialisten} disabled={specialistenBezig}
            className="w-full mb-3 py-2.5 bg-slate-800 rounded-xl text-sm font-medium text-white disabled:opacity-50">
            {specialistenBezig ? 'Laden...' : 'Ververs specialisten (GET /api/specialists)'}
          </button>

          {specialisten.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {specialisten.map(s => (
                <div key={s.specialist_type} className="bg-slate-900 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{s.label}</p>
                    <p className="text-xs text-slate-500">
                      {s.beschikbaar ? (s.actief ? `Actief sinds ${s.activated_at?.slice(0, 10)}` : 'Beschikbaar, niet actief') : 'In ontwikkeling'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleSpecialist(s.specialist_type, s.actief)}
                    disabled={!s.beschikbaar || specialistToggleBezig === s.specialist_type}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30 ${s.actief ? 'bg-red-500/20 text-red-400' : 'bg-primary-500 text-white'}`}
                  >
                    {specialistToggleBezig === s.specialist_type ? '...' : s.actief ? 'Deactiveer' : 'Activeer'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {specialistResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-4">{specialistResultaat}</pre>
          )}

          <button onClick={testDataLayer} disabled={dataLayerBezig}
            className="w-full mb-3 py-2.5 bg-slate-800 rounded-xl text-sm font-medium text-white disabled:opacity-50">
            {dataLayerBezig ? 'Ophalen...' : 'Test: GET /api/specialists/cycling/data'}
          </button>
          {dataLayerResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-4">{dataLayerResultaat}</pre>
          )}

          {/* v2.4.66: Fase 2b — Cycling Analysis Engine */}
          <button onClick={testEngine} disabled={engineBezig}
            className="w-full mb-3 py-2.5 bg-slate-800 rounded-xl text-sm font-medium text-white disabled:opacity-50">
            {engineBezig ? 'Berekenen...' : 'Test: GET /api/specialists/cycling/engine'}
          </button>
          {engineResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-4">{engineResultaat}</pre>
          )}

          {/* v2.4.67: Fase 3 — Coach Layer (AI) */}
          <button onClick={testCoach} disabled={coachBezig}
            className="w-full mb-3 py-2.5 bg-primary-600 rounded-xl text-sm font-medium text-white disabled:opacity-50">
            {coachBezig ? 'AI genereert advies...' : 'Test: POST /api/specialists/cycling/coach (AI)'}
          </button>
          {coachResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-4">{coachResultaat}</pre>
          )}

          {/* v2.4.74: Memory Engine, sub-stap 2 — Learning Engine */}
          <h3 className="text-xs font-bold text-white mb-2 mt-2">Memory Engine — Learning Engine (sub-stap 2/5)</h3>
          <p className="text-xs text-slate-500 mb-3">
            Handmatig een kandidaat-inzicht indienen (tijdelijk — sub-stap 3
            koppelt dit later automatisch aan de AI). Dien 3x hetzelfde
            category in om de candidate→active-promotie te zien.
          </p>
          <input value={testInsight} onChange={e => setTestInsight(e.target.value)}
            placeholder="Inzicht-tekst" className="w-full mb-2 px-3 py-2 bg-slate-900 rounded-lg text-xs text-white" />
          <input value={testCategory} onChange={e => setTestCategory(e.target.value)}
            placeholder="Category" className="w-full mb-3 px-3 py-2 bg-slate-900 rounded-lg text-xs text-white" />
          <div className="flex gap-2 mb-3">
            <button onClick={dienKandidaatIn} disabled={memoryBezig}
              className="flex-1 py-2.5 bg-primary-600 rounded-xl text-xs font-medium text-white disabled:opacity-50">
              {memoryBezig ? 'Bezig...' : 'Dien kandidaat in (POST)'}
            </button>
            <button onClick={laadMemory} disabled={memoryBezig}
              className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-medium text-white disabled:opacity-50">
              Ververs Memory (GET)
            </button>
          </div>
          {memoryResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-4">{memoryResultaat}</pre>
          )}

          {/* v2.4.85: Decision Engine — directe test met echte data */}
          <h3 className="text-xs font-bold text-white mb-2 mt-2">Decision Engine (v2.4.84-85)</h3>
          <p className="text-xs text-slate-500 mb-3">
            Gebruikt de echte, actuele specialist_summary's van je actieve
            specialisten — geen nepdata. Vergt 2+ actieve specialisten met
            elk een recente analyse om een conflict te kunnen tonen.
          </p>
          <button onClick={testDecisionEngine} disabled={decisionBezig}
            className="w-full mb-3 py-2.5 bg-slate-800 rounded-xl text-sm font-medium text-white disabled:opacity-50">
            {decisionBezig ? 'Bezig...' : 'Test: GET /api/specialists/decision-test'}
          </button>
          {decisionResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-4">{decisionResultaat}</pre>
          )}

          {/* v2.4.96: Adaptive Training Plan Engine, Fase 1 */}
          <h3 className="text-xs font-bold text-white mb-2 mt-2">Adaptive Training Plan Engine (Fase 1, v2.4.96)</h3>
          <p className="text-xs text-slate-500 mb-3">
            Vergt een ingevuld Cycling Profile met trainingsdagen (Instellingen).
            Genereren maakt een nieuw plan (sluit het vorige actieve plan af).
            Ophalen voert eerst de Daily Adjustment Layer uit.
          </p>
          <div className="flex gap-2 mb-3">
            <button onClick={genereerPlan} disabled={planBezig}
              className="flex-1 py-2.5 bg-primary-600 rounded-xl text-xs font-medium text-white disabled:opacity-50">
              {planBezig ? 'Bezig...' : 'Genereer plan (POST)'}
            </button>
            <button onClick={haalPlanOp} disabled={planBezig}
              className="flex-1 py-2.5 bg-slate-800 rounded-xl text-xs font-medium text-white disabled:opacity-50">
              Haal plan op (GET)
            </button>
          </div>
          {planResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-4">{planResultaat}</pre>
          )}

          {/* v2.4.97: Coach-uitleglaag, Fase 2 */}
          <h3 className="text-xs font-bold text-white mb-2 mt-2">Coach-uitleglaag (Fase 2, v2.4.97)</h3>
          <p className="text-xs text-slate-500 mb-3">
            Vergt een gegenereerd plan met een sessie voor vandaag. AI zet
            de al-vastgestelde beslissing om in uitleg, beslist zelf niets.
          </p>
          <button onClick={haalUitlegOp} disabled={uitlegBezig}
            className="w-full mb-3 py-2.5 bg-primary-600 rounded-xl text-xs font-medium text-white disabled:opacity-50">
            {uitlegBezig ? 'AI schrijft uitleg...' : 'Test: GET .../training-plan/explain'}
          </button>
          {uitlegResultaat && (
            <pre className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">{uitlegResultaat}</pre>
          )}
        </div>

        {/* Wis training sessie — fix voor client-side crashes in training */}
        <button
          onClick={() => {
            try {
              const keys = [
                'coachos_session', 'coachos_training_session',
                'training_instructie_data', 'training_instructie_datum',
                'dagplan_data', 'dagplan_datum',
              ]
              keys.forEach(k => window.localStorage.removeItem(k))
              setWiped(true)
              setTimeout(() => setWiped(false), 2500)
            } catch { /* */ }
          }}
          className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold active:bg-red-500/20"
        >
          {wiped ? '✓ Training sessie gewist' : 'Wis training sessie (fix crash)'}
        </button>

      </div>
    </AppShell>
  )
}
