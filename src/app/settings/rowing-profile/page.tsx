'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

// ── Rowing Profile-instellingen — Fase 1, stap 3 ─────────────────────────
// Bewust minimaal, zie toelichting in api/specialists/rowing/profile/route.ts

const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
const DAGEN_KORT: Record<string, string> = { maandag: 'Ma', dinsdag: 'Di', woensdag: 'Wo', donderdag: 'Do', vrijdag: 'Vr', zaterdag: 'Za', zondag: 'Zo' }

export default function RowingProfielPage() {
  const [laden, setLaden] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [message, setMessage] = useState('')
  const [trainingsdagen, setTrainingsdagen] = useState<string[]>([])
  const [beschikbareUren, setBeschikbareUren] = useState('3')

  useEffect(() => {
    fetch('/api/specialists/rowing/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.preferences?.trainingsdagen) setTrainingsdagen(d.preferences.trainingsdagen)
        if (d.preferences?.beschikbare_uren_per_week) setBeschikbareUren(String(d.preferences.beschikbare_uren_per_week))
      })
      .finally(() => setLaden(false))
  }, [])

  function toggleDag(dag: string) {
    setTrainingsdagen(prev => prev.includes(dag) ? prev.filter(d => d !== dag) : [...prev, dag])
  }

  async function opslaanKlik() {
    setOpslaan(true)
    try {
      const res = await fetch('/api/specialists/rowing/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingsdagen, beschikbare_uren_per_week: Number(beschikbareUren) }),
      })
      if (res.ok) { setMessage('Opgeslagen'); setTimeout(() => setMessage(''), 2000) }
      else setMessage('Mislukt')
    } catch { setMessage('Mislukt') } finally { setOpslaan(false) }
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/rowing" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Rowing Profiel</h1>
        </div>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && (
          <Card className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-white mb-2">Trainingsdagen</p>
              <p className="text-xs text-slate-500 mb-3">Apart van je Cycling/Running-trainingsdagen — je kunt andere dagen roeien.</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAGEN.map(dag => (
                  <button key={dag} onClick={() => toggleDag(dag)}
                    className={`py-2 rounded-lg text-xs font-medium ${trainingsdagen.includes(dag) ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                    {DAGEN_KORT[dag]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-white mb-2">Beschikbare uren per week</p>
              <input type="number" value={beschikbareUren} onChange={e => setBeschikbareUren(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" min="1" max="20" />
            </div>

            <Button onClick={opslaanKlik} disabled={opslaan || trainingsdagen.length === 0}>
              {opslaan ? 'Bezig...' : 'Opslaan'}
            </Button>
            {message && <p className="text-xs text-center text-slate-400">{message}</p>}
          </Card>
        )}
      </div>
    </AppShell>
  )
}
