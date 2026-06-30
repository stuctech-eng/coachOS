'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Dumbbell, Zap, Wind, Footprints, Bike, Waves } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'

import { KETTLEBELL_OEFENINGEN } from '@/lib/kettlebell-exercises'
import { BODYWEIGHT_OEFENINGEN } from '@/lib/bodyweight-exercises'
import { STRENGTH_OEFENINGEN } from '@/lib/strength-exercises'
import { MOBILITY_OEFENINGEN } from '@/lib/mobility-exercises'
import { RECOVERY_MODULES } from '@/lib/recovery-exercises'
import { RUNNING_DRILLS } from '@/lib/running-drills'
import { ROWING_DRILLS } from '@/lib/rowing-drills'
import { CYCLING_DRILLS } from '@/lib/cycling-drills'

interface ArchiefOefening {
  id: string
  naam: string
  sub: string
  illustratie?: string
}

interface ArchiefCategorie {
  id: string
  label: string
  icon: React.ElementType
  kleur: string
  bg: string
  module: string // training module voor de sessie-engine
  oefeningen: ArchiefOefening[]
}

const CATEGORIEEN: ArchiefCategorie[] = [
  {
    id: 'kettlebell',
    label: 'Kettlebell',
    icon: Dumbbell,
    kleur: 'text-blue-400',
    bg: 'bg-blue-500/20',
    module: 'kettlebell',
    oefeningen: KETTLEBELL_OEFENINGEN.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
      illustratie: (o as { illustratie?: string }).illustratie,
    })),
  },
  {
    id: 'bodyweight',
    label: 'Bodyweight & Core',
    icon: Dumbbell,
    kleur: 'text-orange-400',
    bg: 'bg-orange-500/20',
    module: 'bodyweight',
    oefeningen: BODYWEIGHT_OEFENINGEN.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
      illustratie: (o as { illustratie?: string }).illustratie,
    })),
  },
  {
    id: 'strength',
    label: 'Kracht',
    icon: Dumbbell,
    kleur: 'text-red-400',
    bg: 'bg-red-500/20',
    module: 'strength',
    oefeningen: STRENGTH_OEFENINGEN.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
      illustratie: (o as { illustratie?: string }).illustratie,
    })),
  },
  {
    id: 'mobility',
    label: 'Mobiliteit',
    icon: Zap,
    kleur: 'text-green-400',
    bg: 'bg-green-500/20',
    module: 'mobility',
    oefeningen: MOBILITY_OEFENINGEN.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
      illustratie: (o as { illustratie?: string }).illustratie,
    })),
  },
  {
    id: 'recovery',
    label: 'Herstel',
    icon: Wind,
    kleur: 'text-purple-400',
    bg: 'bg-purple-500/20',
    module: 'recovery',
    oefeningen: RECOVERY_MODULES.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
    })),
  },
  {
    id: 'running',
    label: 'Hardlopen',
    icon: Footprints,
    kleur: 'text-teal-400',
    bg: 'bg-teal-500/20',
    module: 'running',
    oefeningen: RUNNING_DRILLS.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
    })),
  },
  {
    id: 'rowing',
    label: 'Roeien',
    icon: Waves,
    kleur: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    module: 'rowing',
    oefeningen: ROWING_DRILLS.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
    })),
  },
  {
    id: 'cycling',
    label: 'Fietsen',
    icon: Bike,
    kleur: 'text-amber-400',
    bg: 'bg-amber-500/20',
    module: 'cycling',
    oefeningen: CYCLING_DRILLS.map(o => ({
      id: o.id, naam: o.naam, sub: o.categorie,
    })),
  },
]

export default function ArchiefPage() {
  const router = useRouter()
  const [openCategorieen, setOpenCategorieen] = useState<string[]>([])
  const [zoek, setZoek] = useState('')

  function toggleCategorie(id: string) {
    setOpenCategorieen(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  function startOefening(categorie: ArchiefCategorie, oefening: ArchiefOefening) {
    // Sla de gekozen losse oefening op zodat de sessie-engine
    // weet dat dit een archief-test is, los van de coach
    try {
      localStorage.setItem('archief_oefening_pending', JSON.stringify({
        module: categorie.module,
        oefeningNaam: oefening.naam,
        oefeningId: oefening.id,
      }))
      localStorage.setItem('library_module_pending', categorie.module)
      localStorage.setItem('library_module_datum', new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }))
    } catch { /* */ }
    router.push(`/training/session/${categorie.module}?source=library&archief=1&oefening=${encodeURIComponent(oefening.naam)}`)
  }

  const totaalOefeningen = CATEGORIEEN.reduce((a, c) => a + c.oefeningen.length, 0)

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/training')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Archief</h1>
            <p className="text-xs text-slate-500">{totaalOefeningen} oefeningen · alle bibliotheken</p>
          </div>
        </div>

        <input
          type="text"
          placeholder="Zoek een oefening..."
          value={zoek}
          onChange={e => setZoek(e.target.value)}
          className="w-full bg-coach-card border border-coach-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />

        <div className="flex flex-col gap-3">
          {CATEGORIEEN.map(cat => {
            const CatIcon = cat.icon
            const isOpen = openCategorieen.includes(cat.id) || zoek.length > 0
            const gefilterd = zoek
              ? cat.oefeningen.filter(o => o.naam.toLowerCase().includes(zoek.toLowerCase()))
              : cat.oefeningen

            if (zoek && gefilterd.length === 0) return null

            return (
              <div key={cat.id} className="bg-coach-card rounded-2xl border border-coach-border overflow-hidden">
                <button onClick={() => toggleCategorie(cat.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 active:opacity-70">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cat.bg)}>
                    <CatIcon size={16} className={cat.kleur} />
                  </div>
                  <p className={cn('text-sm font-semibold flex-1 text-left', cat.kleur)}>{cat.label}</p>
                  <span className="text-xs text-slate-600 mr-2">{gefilterd.length}</span>
                  <ChevronRight size={14} className={cn('text-slate-600 transition-transform flex-shrink-0', isOpen && 'rotate-90')} />
                </button>

                {isOpen && (
                  <div className="flex flex-col border-t border-coach-border max-h-96 overflow-y-auto">
                    {gefilterd.map((oef, i) => (
                      <button key={i} onClick={() => startOefening(cat, oef)}
                        className="w-full active:opacity-70 text-left px-4 py-3 flex items-center gap-3 border-b border-coach-border/50 last:border-0">
                        <div className="flex-1">
                          <p className="text-white text-sm">{oef.naam}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{oef.sub}{oef.illustratie ? ' · 🖼️ illustratie' : ''}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Card className="p-4 bg-blue-500/5 border-blue-500/20">
          <p className="text-xs text-blue-400 leading-relaxed">
            Het archief staat los van je coach advies. Hier kun je elke oefening los bekijken en trainen om de bibliotheek te testen.
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
