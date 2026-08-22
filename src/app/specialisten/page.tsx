'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Bike, Footprints, Waves, Dumbbell, Salad, Gauge } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Specialisten-overzicht ───────────────────────────────────────────────
// v2.4.93, Navigatie-architectuur v1.0. Vervangt functioneel de "Mijn
// Coaches"-chip-rij uit de Coach-tab (v2.4.69/83) — die rij wordt
// verwijderd nu deze eigen tab bestaat, geen dubbele ingang.
//
// Specialisten zijn geen "extra coach", maar een eigen laag (Specialist
// Engines, Decision Engine, Goal Engine, Memory Engine, CoachPolicy) —
// vandaar een eigen, gelijkwaardige plek in de hoofdnavigatie.

interface SpecialistInfo {
  specialist_type: string
  label: string
  beschikbaar: boolean
  actief: boolean
  lifecycle: { state: string; vorige_actieve_periode: { start: string; eind: string } | null } | null
}

// v2.4.349: kettlebell toegevoegd — eigen icoon (Gauge, verwijst naar
// RPM/pacing-focus van Girevoy Sport), los van het generieke Dumbbell-
// icoon van 'strength'.
const SPECIALIST_ICOON: Record<string, typeof Bike> = {
  cycling: Bike,
  running: Footprints,
  rowing: Waves,
  kettlebell: Gauge,
  strength: Dumbbell,
  nutrition: Salad,
}

// v2.4.93: verhuisd vanuit chat/page.tsx — was daar hardcoded, nu hier
// hetzelfde generieke patroon
const SPECIALIST_WERKWOORD: Record<string, string> = {
  cycling: 'fietst',
  running: 'hardloopt',
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

function lifecycleLabel(state: string | undefined): { tekst: string; kleur: string } | null {
  if (state === 'DORMANT') return { tekst: 'Even stil', kleur: 'text-slate-500' }
  return null
}

export default function SpecialistenPage() {
  const router = useRouter()
  const [specialisten, setSpecialisten] = useState<SpecialistInfo[]>([])
  const [laden, setLaden] = useState(true)
  // v2.4.93: SUGGESTED/RETURNING-banners, verhuisd vanuit de Coach-tab —
  // hoort nu beter thuis bij Specialisten dan bij het Master Coach-gesprek
  const [suggestie, setSuggestie] = useState<SpecialistInfo | null>(null)
  const [terugkeer, setTerugkeer] = useState<SpecialistInfo | null>(null)
  const [activerenBezig, setActiverenBezig] = useState(false)

  useEffect(() => { laadSpecialisten() }, [])

  async function laadSpecialisten() {
    try {
      const res = await fetch('/api/specialists', { credentials: 'include' })
      const data = await res.json()
      const alle: SpecialistInfo[] = data.specialisten || []
      setSpecialisten(alle)

      for (const s of alle) {
        if (s.lifecycle?.state === 'SUGGESTED') { setSuggestie(s); break }
        if (s.lifecycle?.state === 'RETURNING') { setTerugkeer(s); break }
      }
    } catch {
      setSpecialisten([])
    } finally {
      setLaden(false)
    }
  }

  async function activeer(type: string) {
    setActiverenBezig(true)
    try {
      await fetch('/api/specialists', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialist_type: type, active: true }),
      })
      router.push(`/coach/${type}`)
    } catch {
      setActiverenBezig(false)
    }
  }

  const actief = specialisten.filter(s => s.actief)
  const beschikbaarNietActief = specialisten.filter(s => !s.actief && s.beschikbaar)
  const inOntwikkeling = specialisten.filter(s => !s.beschikbaar)

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Specialisten</h1>
          <p className="text-xs text-slate-500 mt-1">Vakinhoudelijke expertise, per sport</p>
        </div>

        {laden && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-coach-card animate-pulse" />)}
          </div>
        )}

        {!laden && suggestie && (
          <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-4">
            <p className="text-sm text-white mb-3">
              Je {SPECIALIST_WERKWOORD[suggestie.specialist_type] || 'sport'} de laatste tijd regelmatig. Wil je de {suggestie.label} activeren voor gerichte begeleiding?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setSuggestie(null)} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium">
                Niet nu
              </button>
              <button onClick={() => activeer(suggestie.specialist_type)} disabled={activerenBezig}
                className="flex-1 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold disabled:opacity-50">
                {activerenBezig ? 'Bezig...' : 'Activeren'}
              </button>
            </div>
          </div>
        )}

        {!laden && terugkeer && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <p className="text-sm text-white mb-1">Welkom terug! 👋</p>
            <p className="text-xs text-slate-400 mb-3">
              {terugkeer.lifecycle?.vorige_actieve_periode
                ? `Je vorige trainingsblok liep tot ${formatDatum(terugkeer.lifecycle.vorige_actieve_periode.eind)}. Zullen we het schema weer oppakken?`
                : `Zullen we je ${terugkeer.label}-schema weer oppakken?`}
            </p>
            <Link href={`/coach/${terugkeer.specialist_type}`}
              className="w-full py-2 rounded-xl bg-green-500/20 text-green-400 text-xs font-semibold border border-green-500/30">
              Naar {terugkeer.label}
            </Link>
          </div>
        )}

        {!laden && actief.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Actief</p>
            <div className="flex flex-col gap-2">
              {actief.map(s => {
                const Icoon = SPECIALIST_ICOON[s.specialist_type] || Bike
                const badge = lifecycleLabel(s.lifecycle?.state)
                return (
                  <Link key={s.specialist_type} href={`/coach/${s.specialist_type}`} className="w-full text-left">
                    <Card className="p-4 active:bg-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                          <Icoon size={18} className="text-primary-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">{s.label}</p>
                          {badge && <p className={`text-xs ${badge.kleur}`}>{badge.tekst}</p>}
                        </div>
                        <ChevronRight size={16} className="text-slate-600" />
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {!laden && beschikbaarNietActief.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Beschikbaar</p>
            <div className="flex flex-col gap-2">
              {beschikbaarNietActief.map(s => {
                const Icoon = SPECIALIST_ICOON[s.specialist_type] || Bike
                return (
                  // v2.4.259-FIX: gemeld — Rowing activeren werkte niet,
                  // bleef altijd "Nog niet geactiveerd" tonen, ondanks
                  // dat alles functioneel al werkte. Root cause: dit was
                  // een kale <Link> die rechtstreeks naar /coach/rowing
                  // navigeerde — de al-bestaande activeer()-functie
                  // (hierboven, POST met active:true) werd hier nooit
                  // aangeroepen. Nu: eerst activeren, dan navigeren
                  // (activeer() doet zelf al de router.push).
                  <button key={s.specialist_type} onClick={() => activeer(s.specialist_type)} disabled={activerenBezig}
                    className="w-full text-left disabled:opacity-50">
                    <Card className="p-4 active:bg-slate-700 opacity-80">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <Icoon size={18} className="text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">{s.label}</p>
                          <p className="text-xs text-slate-500">{activerenBezig ? 'Activeren...' : 'Tik om te activeren'}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600" />
                      </div>
                    </Card>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!laden && inOntwikkeling.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Binnenkort</p>
            <div className="flex flex-col gap-2">
              {inOntwikkeling.map(s => {
                const Icoon = SPECIALIST_ICOON[s.specialist_type] || Bike
                return (
                  <div key={s.specialist_type} className="opacity-40">
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <Icoon size={18} className="text-slate-500" />
                        </div>
                        <p className="text-sm text-slate-400 font-medium">{s.label}</p>
                      </div>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
