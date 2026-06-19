'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { AppShell } from '@/components/layout'

interface LogItem {
  tekst: string
  status: 'ok' | 'fout' | 'info' | 'warn'
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [bezig, setBezig] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wiped, setWiped] = useState(false)

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

      // 3. Supabase database
      log('── DATABASE ──', 'info')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .limit(1)
        .single()

      if (profileError) {
        log(`Profiles query FOUT: ${profileError.message}`, 'fout')
      } else {
        log(`Profiles tabel: bereikbaar (${profileData?.display_name || profileData?.user_id?.slice(0, 8)})`, 'ok')
      }

      const { error: checkinError } = await supabase
        .from('daily_checkins')
        .select('id')
        .limit(1)
      log(`daily_checkins: ${checkinError ? 'FOUT — ' + checkinError.message : 'bereikbaar'}`,
        checkinError ? 'fout' : 'ok')

      const { error: garminError } = await supabase
        .from('garmin_imports')
        .select('id')
        .limit(1)
      log(`garmin_imports: ${garminError ? 'FOUT — ' + garminError.message : 'bereikbaar'}`,
        garminError ? 'fout' : 'ok')

      const { error: coachError } = await supabase
        .from('coach_recommendations')
        .select('id')
        .limit(1)
      log(`coach_recommendations: ${coachError ? 'FOUT — ' + coachError.message : 'bereikbaar'}`,
        coachError ? 'fout' : 'ok')

      // 4. API routes
      log('── API ROUTES ──', 'info')

      const apiTests = [
        { naam: '/api/checkin', methode: 'GET' },
        { naam: '/api/status', methode: 'GET' },
      ]

      for (const test of apiTests) {
        try {
          const res = await fetch(test.naam, { method: test.methode, credentials: 'include' })
          log(`${test.naam}: ${res.status} ${res.ok ? 'OK' : 'FOUT'}`,
            res.ok ? 'ok' : 'fout')
        } catch (e) {
          log(`${test.naam}: FOUT — ${(e as Error).message}`, 'fout')
        }
      }

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
              log(`${key}: aanwezig maar GEEN geldige JSON (${raw.slice(0, 40)}...)`, 'fout')
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
          <p className="text-slate-400 text-sm mt-0.5">CoachOS diagnostiek</p>
        </div>

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
