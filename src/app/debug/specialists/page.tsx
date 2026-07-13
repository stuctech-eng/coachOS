'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// v2.4.60 (kandidaat) — TIJDELIJK testschermpje voor Fase 1 (Specialist
// Registry). Geen onderdeel van de uiteindelijke architectuur — puur om
// /api/specialists te kunnen testen zonder curl/Postman, direct op de
// telefoon. Wordt vervangen zodra de echte Hub-UI gebouwd wordt
// (specialist-engine-architecture.md, Hub-modules-sectie).

interface Specialist {
  specialist_type: string
  label: string
  beschikbaar: boolean
  actief: boolean
  activated_at: string | null
}

export default function DebugSpecialistsPage() {
  const router = useRouter()
  const [specialisten, setSpecialisten] = useState<Specialist[]>([])
  const [laden, setLaden] = useState(true)
  const [bezig, setBezig] = useState<string | null>(null)
  const [laatsteResultaat, setLaatsteResultaat] = useState<string>('')

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

  useEffect(() => { laadSpecialisten() }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/debug')} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
          <ArrowLeft size={18} className="text-slate-400" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Debug: Specialists (Fase 1)</h1>
          <p className="text-xs text-amber-400">Tijdelijk testschermpje — niet de uiteindelijke UI</p>
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
      <pre className="bg-black/50 rounded-xl p-3 text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
        {laatsteResultaat || '(nog niets opgehaald)'}
      </pre>
    </div>
  )
}
