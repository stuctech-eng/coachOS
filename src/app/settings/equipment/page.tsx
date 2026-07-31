'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

interface Equipment {
  id: keyof EquipmentState
  label: string
  sub: string
  emoji: string
}

interface EquipmentState {
  kettlebell_available: boolean
  concept2_available: boolean
  cycling_available: boolean
  running_available: boolean
  dumbbell_available: boolean
  barbell_available: boolean
  ab_wheel_available: boolean
  bodyweight_available: boolean
}

const EQUIPMENT_LIJST: Equipment[] = [
  { id: 'kettlebell_available', label: 'Kettlebell', sub: 'Kettlebell training', emoji: '🏋️' },
  { id: 'concept2_available', label: 'Concept2 Roeimachine', sub: 'Indoor roeien', emoji: '🚣' },
  // v2.4.209-FIX: "Indoor Fiets" was een verkeerde naam — de
  // onderliggende oefeningen (Recovery Ride, Sweet Spot, VO2max-
  // intervallen, etc.) zijn op één na (Enkel Been Drill) allemaal
  // generiek geschreven, niet indoor-specifiek. Simpelweg hernoemd
  // i.p.v. gesplitst — een indoor/buiten-onderscheid zou hier een
  // schijn-verschil zijn zonder functionele betekenis.
  { id: 'cycling_available', label: 'Fietsen', sub: 'Indoor of buiten', emoji: '🚴' },
  { id: 'running_available', label: 'Hardlopen', sub: 'Buiten of op loopband', emoji: '🏃' },
  { id: 'dumbbell_available', label: 'Dumbbells', sub: 'Vrije gewichten', emoji: '💪' },
  { id: 'barbell_available', label: 'Barbell + Gewichten', sub: 'Olympische stang', emoji: '🏋️' },
  { id: 'ab_wheel_available', label: 'Ab Wheel', sub: 'Buikspier rol', emoji: '⚙️' },
  { id: 'bodyweight_available', label: 'Bodyweight', sub: 'Altijd beschikbaar', emoji: '🤸' },
]

export default function EquipmentPage() {
  const router = useRouter()
  const [equipment, setEquipment] = useState<EquipmentState>({
    kettlebell_available: true,
    concept2_available: false,
    cycling_available: false,
    running_available: false,
    dumbbell_available: false,
    barbell_available: false,
    ab_wheel_available: false,
    bodyweight_available: true,
  })
  const [laden, setLaden] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(false)

  useEffect(() => {
    fetch('/api/equipment', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setEquipment(data) })
      .catch(() => {})
      .finally(() => setLaden(false))
  }, [])

  function toggle(id: keyof EquipmentState) {
    if (id === 'bodyweight_available') return // altijd aan
    setEquipment(prev => ({ ...prev, [id]: !prev[id] }))
    setOpgeslagen(false)
  }

  async function handleOpslaan() {
    setOpslaan(true)
    try {
      const res = await fetch('/api/equipment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equipment),
      })
      if (res.ok) {
        setOpgeslagen(true)
        setTimeout(() => router.push('/settings'), 1000)
      }
    } catch { /* */ }
    finally { setOpslaan(false) }
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={'/settings'}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5"
          >
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Equipment</h1>
            <p className="text-xs text-slate-500">Trainer AI gebruikt dit voor sessieselectie</p>
          </div>
        </div>

        {laden ? (
          <div className="flex flex-col gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <Card className="divide-y divide-coach-border">
            {EQUIPMENT_LIJST.map(item => {
              const aan = equipment[item.id]
              const isBodyweight = item.id === 'bodyweight_available'
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className="flex items-center gap-4 px-4 py-4 w-full active:bg-slate-800/50"
                  disabled={isBodyweight}
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    aan ? 'bg-green-500 border-green-500' : 'border-slate-600'
                  }`}>
                    {aan && <Check size={14} className="text-white" />}
                  </div>
                </button>
              )
            })}
          </Card>
        )}

        <button
          onClick={handleOpslaan}
          disabled={opslaan || laden}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-colors ${
            opgeslagen
              ? 'bg-green-500 text-white'
              : 'bg-primary-500 text-white active:bg-primary-600 disabled:opacity-40'
          }`}
        >
          {opgeslagen ? '✓ Opgeslagen' : opslaan ? 'Opslaan...' : 'Opslaan'}
        </button>

      </div>
    </AppShell>
  )
}
