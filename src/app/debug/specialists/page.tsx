'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { browserClient } from '@/lib/supabase'
import Link from 'next/link'

// v2.4.64 — Testschermpje herbouwd: ingebouwd inlogformulier, GEEN
// paginanavigatie meer naar /login. Test-hypothese: het "pagina reset
// zichzelf"-probleem trad mogelijk specifiek op TIJDENS een paginawissel
// (client-side navigatie tussen routes), niet door de service worker
// zelf (die staat sinds v2.4.63 al volledig uit, disable: true, en het
// probleem bleef optreden). Door inloggen en testen op exact dezelfde
// pagina te laten gebeuren, zonder ooit router.push() aan te roepen,
// isoleren we of navigatie zelf de trigger was.

interface Specialist {
  specialist_type: string
  label: string
  beschikbaar: boolean
  actief: boolean
  activated_at: string | null
}

export default function DebugSpecialistsPage() {
  const router = useRouter()
  const [ingelogd, setIngelogd] = useState<boolean | null>(null) // null = nog aan het checken
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [inlogFout, setInlogFout] = useState('')
  const [inloggenBezig, setInloggenBezig] = useState(false)

  const [specialisten, setSpecialisten] = useState<Specialist[]>([])
  const [laden, setLaden] = useState(false)
  const [bezig, setBezig] = useState<string | null>(null)
  const [laatsteResultaat, setLaatsteResultaat] = useState<string>('')
  const [dataLayerBezig, setDataLayerBezig] = useState(false)
  const [dataLayerResultaat, setDataLayerResultaat] = useState<string>('')

  // Checkt bij laden of er al een sessie is — geen navigatie, alleen
  // een lokale state-update
  useEffect(() => {
    browserClient.auth.getSession().then(({ data: { session } }) => {
      setIngelogd(!!session)
      if (session) laadSpecialisten()
    })
  }, [])

  async function handleInloggen(e: React.FormEvent) {
    e.preventDefault()
    setInloggenBezig(true)
    setInlogFout('')
    try {
      const { error } = await browserClient.auth.signInWithPassword({ email, password: wachtwoord })
      if (error) {
        setInlogFout(error.message)
      } else {
        setIngelogd(true)
        await laadSpecialisten()
      }
    } catch (e) {
      setInlogFout((e as Error).message)
    } finally {
      setInloggenBezig(false)
    }
  }

  async function laadSpecialisten() {
    setLaden(true)
    try {
      const res = await fetch('/api/specialists', { credentials: 'include' })
      const data = await res.json()
      setLaatsteResultaat(`GET /api/specialists →\n${JSON.stringify(data, null, 2)}`)
      setSpecialisten(data.specialisten || [])
    } catch (e) {
      setLaatsteResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setLaden(false)
    }
  }

  async function toggleSpecialist(type: string, huidigeStatus: boolean) {
    setBezig(type)
    try {
      const res = await fetch('/api/specialists', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialist_type: type, active: !huidigeStatus }),
      })
      const data = await res.json()
      setLaatsteResultaat(`POST /api/specialists (${type}, active: ${!huidigeStatus}) →\n${JSON.stringify(data, null, 2)}`)
      await laadSpecialisten()
    } catch (e) {
      setLaatsteResultaat(`FOUT: ${(e as Error).message}`)
    } finally {
      setBezig(null)
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

  // ── Nog aan het checken of er een sessie is ──────────────────────────
  if (ingelogd === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-6 flex items-center justify-center">
        <p className="text-sm text-slate-500">Sessie checken...</p>
      </div>
    )
  }

  // ── Niet ingelogd: inlogformulier, GEEN navigatie naar /login ────────
  if (!ingelogd) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={'/debug'} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Debug: Specialists (Fase 1+2a)</h1>
            <p className="text-xs text-amber-400">Log hier direct in — geen aparte /login-pagina nodig</p>
          </div>
        </div>

        <form onSubmit={handleInloggen} className="flex flex-col gap-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="E-mail" required
            className="bg-[#1c2128] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500" />
          <input type="password" value={wachtwoord} onChange={e => setWachtwoord(e.target.value)}
            placeholder="Wachtwoord" required
            className="bg-[#1c2128] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500" />
          {inlogFout && <p className="text-xs text-red-400">{inlogFout}</p>}
          <button type="submit" disabled={inloggenBezig}
            className="py-3 bg-primary-500 rounded-xl text-sm font-semibold disabled:opacity-50">
            {inloggenBezig ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>
      </div>
    )
  }

  // ── Ingelogd: het eigenlijke testschermpje, exact zelfde als v2.4.61 ─
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={'/debug'} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
          <ArrowLeft size={18} className="text-slate-400" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Debug: Specialists (Fase 1+2a)</h1>
          <p className="text-xs text-amber-400">Tijdelijk testschermpje — geen navigatie meer nodig om in te loggen</p>
        </div>
      </div>

      <button onClick={laadSpecialisten} disabled={laden}
        className="w-full mb-4 py-2.5 bg-slate-800 rounded-xl text-sm font-medium disabled:opacity-50">
        {laden ? 'Laden...' : 'Ververs lijst (GET)'}
      </button>

      <div className="flex flex-col gap-2 mb-6">
        {specialisten.map(s => (
          <div key={s.specialist_type} className="bg-[#1c2128] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-slate-500">
                {s.beschikbaar ? (s.actief ? `Actief sinds ${s.activated_at?.slice(0, 10)}` : 'Beschikbaar, niet actief') : 'In ontwikkeling'}
              </p>
            </div>
            <button
              onClick={() => toggleSpecialist(s.specialist_type, s.actief)}
              disabled={!s.beschikbaar || bezig === s.specialist_type}
              className={`px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-30 ${
                s.actief ? 'bg-red-500/20 text-red-400' : 'bg-primary-500 text-white'
              }`}
            >
              {bezig === s.specialist_type ? '...' : s.actief ? 'Deactiveer' : 'Activeer'}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mb-2">Laatste API-resultaat (ruwe JSON):</p>
      <pre className="bg-black/50 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap mb-8">
        {laatsteResultaat || '(nog niets opgehaald)'}
      </pre>

      <div className="border-t border-white/10 pt-6">
        <h2 className="text-sm font-bold mb-1">Fase 2a — Data Layer (Cycling)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Puur ruwe data, geen berekening. Verwacht: activiteiten uit
          activity_sessions + trainingsresultaten uit training_results,
          beide gefilterd op cycling, laatste 90 dagen.
        </p>
        <button onClick={testDataLayer} disabled={dataLayerBezig}
          className="w-full mb-3 py-2.5 bg-slate-800 rounded-xl text-sm font-medium disabled:opacity-50">
          {dataLayerBezig ? 'Ophalen...' : 'Test: GET /api/specialists/cycling/data'}
        </button>
        <pre className="bg-black/50 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
          {dataLayerResultaat || '(nog niets opgehaald)'}
        </pre>
      </div>
    </div>
  )
}
