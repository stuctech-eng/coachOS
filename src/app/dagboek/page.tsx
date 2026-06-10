'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Plus, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'

interface JournalEntry {
  id: string
  created_at: string
  energy: number | null
  stress: number | null
  motivation: number | null
  note: string | null
}

function ScoreKnop({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-9 h-9 rounded-xl text-sm font-semibold transition-colors',
        selected
          ? 'bg-primary-500 text-white'
          : 'bg-slate-800 text-slate-400 active:bg-slate-700'
      )}
    >
      {value}
    </button>
  )
}

function ScoreRij({ label, value, onChange, kleur }: {
  label: string
  value: number | null
  onChange: (v: number) => void
  kleur: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-300">{label}</p>
        {value && <p className={cn('text-sm font-bold', kleur)}>{value}/10</p>}
      </div>
      <div className="flex gap-1.5">
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <ScoreKnop key={n} value={n} selected={value === n} onClick={() => onChange(n)} />
        ))}
      </div>
    </div>
  )
}

function formatTijd(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
  })
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam'
  })
}

export default function DagboekPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [laden, setLaden] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [toonFormulier, setToonFormulier] = useState(false)

  const [energy, setEnergy] = useState<number | null>(null)
  const [stress, setStress] = useState<number | null>(null)
  const [motivation, setMotivation] = useState<number | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    laadEntries()
  }, [])

  async function laadEntries() {
    try {
      const res = await fetch('/api/journal?dagen=7', { credentials: 'include' })
      const data = await res.json()
      setEntries(data.entries || [])
    } catch { /* */ }
    finally { setLaden(false) }
  }

  async function handleOpslaan() {
    if (!energy && !stress && !motivation && !note.trim()) return
    setOpslaan(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ energy, stress, motivation, note: note.trim() || null }),
      })
      if (res.ok) {
        setEnergy(null)
        setStress(null)
        setMotivation(null)
        setNote('')
        setToonFormulier(false)
        await laadEntries()
      }
    } catch { /* */ }
    finally { setOpslaan(false) }
  }

  const vandaagEntries = entries.filter(e => {
    const datum = new Date(e.created_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    return datum === vandaag
  })

  const ouderEntries = entries.filter(e => {
    const datum = new Date(e.created_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    return datum !== vandaag
  })

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/home')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5"
          >
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Dagboek</h1>
            <p className="text-xs text-slate-500">Hoe was je dag?</p>
          </div>
          <button
            onClick={() => setToonFormulier(!toonFormulier)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary-500/20"
          >
            <Plus size={18} className="text-primary-400" />
          </button>
        </div>

        {/* Nieuw formulier */}
        {toonFormulier && (
          <Card className="p-5 flex flex-col gap-5">
            <div className="flex items-center gap-2 text-primary-400">
              <BookOpen size={16} />
              <span className="text-sm font-medium">Nieuwe notitie</span>
            </div>

            <ScoreRij
              label="Energie"
              value={energy}
              onChange={setEnergy}
              kleur="text-green-400"
            />
            <ScoreRij
              label="Stress"
              value={stress}
              onChange={setStress}
              kleur="text-orange-400"
            />
            <ScoreRij
              label="Motivatie"
              value={motivation}
              onChange={setMotivation}
              kleur="text-blue-400"
            />

            <div>
              <p className="text-sm text-slate-300 mb-2">Opmerkingen</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Wat wil je kwijt? Hoe was je dag, wat voelde je..."
                rows={3}
                className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <button
              onClick={handleOpslaan}
              disabled={opslaan || (!energy && !stress && !motivation && !note.trim())}
              className="w-full py-3 bg-primary-500 text-white rounded-xl text-sm font-semibold active:bg-primary-600 disabled:opacity-40"
            >
              {opslaan ? 'Opslaan...' : 'Opslaan'}
            </button>
          </Card>
        )}

        {/* Vandaag */}
        {laden ? (
          <div className="flex flex-col gap-3">
            {[1,2].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {vandaagEntries.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Vandaag</p>
                <div className="flex flex-col gap-3">
                  {vandaagEntries.map(entry => (
                    <EntryKaart key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            )}

            {vandaagEntries.length === 0 && !toonFormulier && (
              <Card className="p-5 text-center">
                <BookOpen size={28} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-4">Nog geen notitie vandaag</p>
                <button
                  onClick={() => setToonFormulier(true)}
                  className="px-5 py-2.5 bg-primary-500/20 text-primary-400 rounded-xl text-sm font-medium"
                >
                  Eerste notitie toevoegen
                </button>
              </Card>
            )}

            {ouderEntries.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Eerder</p>
                <div className="flex flex-col gap-3">
                  {ouderEntries.map(entry => (
                    <EntryKaart key={entry.id} entry={entry} showDatum />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </AppShell>
  )
}

function EntryKaart({ entry, showDatum }: { entry: JournalEntry; showDatum?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs mb-3">
        <Clock size={12} />
        <span>{showDatum ? formatDatum(entry.created_at) + ' · ' : ''}{formatTijd(entry.created_at)}</span>
      </div>

      {(entry.energy || entry.stress || entry.motivation) && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {entry.energy && (
            <div className="bg-slate-800/60 rounded-xl py-2 text-center">
              <p className="text-lg font-bold text-green-400">{entry.energy}</p>
              <p className="text-xs text-slate-500">Energie</p>
            </div>
          )}
          {entry.stress && (
            <div className="bg-slate-800/60 rounded-xl py-2 text-center">
              <p className="text-lg font-bold text-orange-400">{entry.stress}</p>
              <p className="text-xs text-slate-500">Stress</p>
            </div>
          )}
          {entry.motivation && (
            <div className="bg-slate-800/60 rounded-xl py-2 text-center">
              <p className="text-lg font-bold text-blue-400">{entry.motivation}</p>
              <p className="text-xs text-slate-500">Motivatie</p>
            </div>
          )}
        </div>
      )}

      {entry.note && (
        <p className="text-sm text-slate-300 leading-relaxed">{entry.note}</p>
      )}
    </Card>
  )
}
