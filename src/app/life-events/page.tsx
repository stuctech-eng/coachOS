'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Calendar, ChevronRight, X, Check } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { cn } from '@/utils'

interface LifeEvent {
  id: string
  type: string
  start_time: string
  end_time: string | null
  recovery_impact: number
  stress_load: number
  sleep_disruption: number
  notes: string | null
  start_hour: number | null
  end_hour: number | null
  recurrence: string | null
  recurrence_days: number[] | null
  recurrence_end_date: string | null
  vacation_type: string | null
  end_date: string | null
}

interface HolidayEvent {
  date: string
  name: string
  icon: string
}

function getNederlandseFeestdagen(jaar: number): HolidayEvent[] {
  const a = jaar % 19, b = Math.floor(jaar / 100), c = jaar % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const maand = Math.floor((h + l - 7 * m + 114) / 31)
  const dag = ((h + l - 7 * m + 114) % 31) + 1
  const pasen = new Date(jaar, maand - 1, dag)
  const add = (d: Date, n: number) => { const r = new Date(d); r.setDate(d.getDate() + n); return r }
  const s = (d: Date) => d.toISOString().split('T')[0]
  return [
    { date: `${jaar}-01-01`, name: 'Nieuwjaarsdag', icon: '🎆' },
    { date: s(add(pasen, -2)), name: 'Goede Vrijdag', icon: '✝️' },
    { date: s(pasen), name: 'Eerste Paasdag', icon: '🐣' },
    { date: s(add(pasen, 1)), name: 'Tweede Paasdag', icon: '🐣' },
    { date: `${jaar}-04-27`, name: 'Koningsdag', icon: '👑' },
    { date: `${jaar}-05-05`, name: 'Bevrijdingsdag', icon: '🕊️' },
    { date: s(add(pasen, 39)), name: 'Hemelvaartsdag', icon: '☁️' },
    { date: s(add(pasen, 49)), name: 'Eerste Pinksterdag', icon: '🕊️' },
    { date: s(add(pasen, 50)), name: 'Tweede Pinksterdag', icon: '🕊️' },
    { date: `${jaar}-12-25`, name: 'Eerste Kerstdag', icon: '🎄' },
    { date: `${jaar}-12-26`, name: 'Tweede Kerstdag', icon: '🎄' },
  ]
}

const EVENT_CATEGORIES = [
  { id: 'werk', label: 'Werk', icon: '💼', events: [
    { type: 'nachtdienst', label: 'Nachtdienst', icon: '🌙', start_hour: 22, end_hour: 6, recovery_impact: 2, stress_load: 1, sleep_disruption: 3 },
    { type: 'avonddienst', label: 'Avonddienst', icon: '🌆', start_hour: 14, end_hour: 1, recovery_impact: 1, stress_load: 1, sleep_disruption: 2 },
    { type: 'vroege_dienst', label: 'Vroege dienst', icon: '🌅', start_hour: 6, end_hour: 15, recovery_impact: 1, stress_load: 1, sleep_disruption: 2 },
    { type: 'dagdienst', label: 'Dagdienst', icon: '☀️', start_hour: 9, end_hour: 17, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    { type: 'thuiswerken', label: 'Thuiswerken', icon: '🏠', start_hour: 9, end_hour: 17, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    { type: 'lange_dag', label: 'Lange dag', icon: '⏰', start_hour: 8, end_hour: 20, recovery_impact: 1, stress_load: 2, sleep_disruption: 1 },
    { type: 'vrije_dag', label: 'Vrije dag', icon: '🗓️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    { type: 'werk_stress', label: 'Werkstress', icon: '😤', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 3, sleep_disruption: 1 },
  ]},
  { id: 'leven', label: 'Leven', icon: '🌍', events: [
    { type: 'vakantie', label: 'Vakantie', icon: '🏖️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 1 },
    { type: 'reizen', label: 'Reizen', icon: '✈️', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 1 },
    { type: 'feest', label: 'Feest / Late avond', icon: '🎉', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 0, sleep_disruption: 2 },
    { type: 'sociaal', label: 'Familie / sociaal', icon: '👨‍👩‍👧', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 1, sleep_disruption: 0 },
    { type: 'jetlag', label: 'Jetlag', icon: '🌍', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 3 },
  ]},
  { id: 'gezondheid', label: 'Gezondheid', icon: '❤️', events: [
    { type: 'ziek', label: 'Ziek', icon: '🤒', start_hour: null, end_hour: null, recovery_impact: 3, stress_load: 1, sleep_disruption: 2 },
    { type: 'emotionele_stress', label: 'Emotionele stress', icon: '😔', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 3, sleep_disruption: 2 },
    { type: 'slecht_geslapen', label: 'Slecht geslapen', icon: '😴', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 0, sleep_disruption: 3 },
    { type: 'hersteldag', label: 'Hersteldag', icon: '🛋️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
  ]},
  { id: 'omgeving', label: 'Omgeving', icon: '🌡️', events: [
    { type: 'extreme_hitte', label: 'Extreme hitte', icon: '🌡️', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 1 },
  ]},
]

const EVENT_TYPES = EVENT_CATEGORIES.flatMap(c => c.events)

const DAGEN = [
  { label: 'Ma', nummer: 1 }, { label: 'Di', nummer: 2 },
  { label: 'Wo', nummer: 3 }, { label: 'Do', nummer: 4 },
  { label: 'Vr', nummer: 5 }, { label: 'Za', nummer: 6 },
  { label: 'Zo', nummer: 0 },
]

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Eenmalig' },
  { value: 'workdays', label: 'Werkdagen', sub: 'ma t/m vr' },
  { value: 'weekend', label: 'Weekend', sub: 'za + zo' },
  { value: 'weekly', label: 'Wekelijks', sub: 'zelfde dag', needsDay: true },
  { value: 'biweekly', label: 'Om de week', sub: 'elke 2 weken', needsDay: true },
  { value: 'daily', label: 'Dagelijks', sub: 'elke dag' },
  { value: 'custom', label: 'Aangepast', sub: 'kies dagen', needsDays: true },
]

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Dagelijks', workdays: 'Werkdagen', weekend: 'Weekend',
  weekly: 'Wekelijks', biweekly: 'Om de week', custom: 'Aangepast',
}

function formatUur(uur: number | null): string {
  if (uur === null) return ''
  return `${String(uur).padStart(2, '0')}:00`
}

function formatDatum(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatHerhaling(event: LifeEvent): string {
  if (!event.recurrence) return ''
  const label = RECURRENCE_LABELS[event.recurrence] || event.recurrence
  if (event.recurrence === 'weekly' || event.recurrence === 'biweekly') {
    const dag = DAGEN.find(d => event.recurrence_days?.includes(d.nummer))
    return dag ? `${label} · ${dag.label}` : label
  }
  return label
}

function ImpactBadge({ label, value }: { label: string; value: number }) {
  if (value === 0) return null
  const kleur = value >= 3 ? 'text-red-400 bg-red-500/10' : value >= 2 ? 'text-orange-400 bg-orange-500/10' : 'text-yellow-400 bg-yellow-500/10'
  return <span className={`text-xs px-2 py-0.5 rounded-full ${kleur}`}>{label} {'●'.repeat(value)}</span>
}

// ── Nieuw event sheet ──────────────────────────────────────────────
type Sheet = 'categorie' | 'type' | 'details' | 'herhaling'

function NieuwEventSheet({ onClose, onSave }: {
  onClose: () => void
  onSave: (event: Partial<LifeEvent>) => Promise<void>
}) {
  const [sheet, setSheet] = useState<Sheet>('categorie')
  const [gekozenCategorie, setGekozenCategorie] = useState<typeof EVENT_CATEGORIES[0] | null>(null)
  const [gekozenType, setGekozenType] = useState<typeof EVENT_TYPES[0] | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [startHour, setStartHour] = useState<number | null>(null)
  const [endHour, setEndHour] = useState<number | null>(null)
  const [endDate, setEndDate] = useState('')
  const [vacationType, setVacationType] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function kiesCategorie(cat: typeof EVENT_CATEGORIES[0]) {
    setGekozenCategorie(cat)
    setSheet('type')
  }

  function kiesType(et: typeof EVENT_TYPES[0]) {
    setGekozenType(et)
    setStartHour(et.start_hour)
    setEndHour(et.end_hour)
    setSheet('details')
  }

  function kiesHerhaling(value: string) {
    setRecurrence(value)
    if (value === 'workdays') setRecurrenceDays([1,2,3,4,5])
    else if (value === 'weekend') setRecurrenceDays([6,0])
    else if (value === '' || value === 'daily') setRecurrenceDays([])
  }

  async function opslaan() {
    if (!gekozenType) return
    setSaving(true)
    try {
      await onSave({
        type: gekozenType.type,
        start_time: new Date(startDate + 'T' + String(startHour ?? 9).padStart(2,'0') + ':00:00').toISOString(),
        recovery_impact: gekozenType.recovery_impact,
        stress_load: gekozenType.stress_load,
        sleep_disruption: gekozenType.sleep_disruption,
        start_hour: startHour,
        end_hour: endHour,
        recurrence: recurrence || null,
        recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
        recurrence_end_date: recurrenceEndDate || null,
        end_date: endDate || null,
        vacation_type: vacationType || null,
        notes: notes || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const titel = sheet === 'categorie' ? 'Wat speelt er?' : sheet === 'type' ? gekozenCategorie?.label || '' : sheet === 'herhaling' ? 'Herhaling' : gekozenType?.label || ''

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-coach-darker rounded-t-3xl flex flex-col max-h-[88vh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-coach-border">
          {sheet !== 'categorie' && (
            <button onClick={() => setSheet(sheet === 'type' ? 'categorie' : sheet === 'herhaling' ? 'details' : 'type')}
              className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
              <ArrowLeft size={16} className="text-slate-400" />
            </button>
          )}
          <p className="text-white font-semibold flex-1">{titel}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* Stap 1: Categorie */}
          {sheet === 'categorie' && (
            <div className="grid grid-cols-2 gap-3">
              {EVENT_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => kiesCategorie(cat)}
                  className="bg-slate-800 rounded-2xl p-5 flex flex-col items-center gap-2 active:bg-slate-700">
                  <span className="text-3xl">{cat.icon}</span>
                  <span className="text-white font-medium text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Stap 2: Type */}
          {sheet === 'type' && gekozenCategorie && (
            <div className="flex flex-col gap-2">
              {gekozenCategorie.events.map(et => (
                <button key={et.type} onClick={() => kiesType(et)}
                  className="flex items-center gap-4 p-4 bg-slate-800 rounded-2xl active:bg-slate-700 text-left">
                  <span className="text-2xl w-8 text-center">{et.icon}</span>
                  <div className="flex-1">
                    <p className="text-white font-medium">{et.label}</p>
                    {et.start_hour !== null && (
                      <p className="text-xs text-slate-500">{formatUur(et.start_hour)} – {formatUur(et.end_hour)}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-600" />
                </button>
              ))}
            </div>
          )}

          {/* Stap 3: Details */}
          {sheet === 'details' && gekozenType && (
            <div className="flex flex-col gap-5">

              {/* Datum */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Datum</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              {/* Tijden (alleen bij diensten) */}
              {gekozenType.start_hour !== null && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Tijden</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Begin</p>
                      <select value={startHour ?? ''} onChange={e => setStartHour(Number(e.target.value))}
                        className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Einde</p>
                      <select value={endHour ?? ''} onChange={e => setEndHour(Number(e.target.value))}
                        className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Vakantie specifiek */}
              {gekozenType.type === 'vakantie' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Einddatum</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Type vakantie</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ value: 'actief', label: '🚵 Actief', sub: 'wandelen, fietsen' }, { value: 'ontspanning', label: '🏖️ Ontspanning', sub: 'strand, city trip' }].map(opt => (
                        <button key={opt.value} onClick={() => setVacationType(opt.value)}
                          className={cn('p-4 rounded-xl text-left border',
                            vacationType === opt.value ? 'bg-primary-600/20 border-primary-500/50' : 'bg-slate-800 border-transparent')}>
                          <p className="text-sm font-medium text-white">{opt.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Herhaling (niet bij vakantie) */}
              {gekozenType.type !== 'vakantie' && (
                <button onClick={() => setSheet('herhaling')}
                  className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl active:bg-slate-700">
                  <div className="flex-1 text-left">
                    <p className="text-xs text-slate-400">Herhaling</p>
                    <p className="text-white text-sm mt-0.5">{recurrence ? RECURRENCE_LABELS[recurrence] || recurrence : 'Eenmalig'}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-600" />
                </button>
              )}

              {/* Notitie */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Notitie</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra context (optioneel)"
                  className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <Button onClick={opslaan} loading={saving} fullWidth>Opslaan</Button>
            </div>
          )}

          {/* Stap 4: Herhaling */}
          {sheet === 'herhaling' && (
            <div className="flex flex-col gap-3">
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => kiesHerhaling(opt.value)}
                  className={cn('flex items-center gap-4 p-4 rounded-xl',
                    recurrence === opt.value ? 'bg-primary-600/20 border border-primary-500/50' : 'bg-slate-800')}>
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium">{opt.label}</p>
                    {'sub' in opt && <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>}
                  </div>
                  {recurrence === opt.value && <Check size={18} className="text-primary-400" />}
                </button>
              ))}

              {/* Dag kiezen bij wekelijks/om de week */}
              {(recurrence === 'weekly' || recurrence === 'biweekly') && (
                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-2">Op welke dag?</p>
                  <div className="flex gap-2">
                    {DAGEN.map(dag => (
                      <button key={dag.nummer} onClick={() => setRecurrenceDays([dag.nummer])}
                        className={cn('flex-1 py-2.5 rounded-xl text-xs font-medium',
                          recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                        {dag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Aangepaste dagen */}
              {recurrence === 'custom' && (
                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-2">Welke dagen?</p>
                  <div className="flex gap-2">
                    {DAGEN.map(dag => (
                      <button key={dag.nummer} onClick={() => setRecurrenceDays(
                        recurrenceDays.includes(dag.nummer) ? recurrenceDays.filter(d => d !== dag.nummer) : [...recurrenceDays, dag.nummer]
                      )}
                        className={cn('flex-1 py-2.5 rounded-xl text-xs font-medium',
                          recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                        {dag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Einddatum */}
              {recurrence !== '' && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-slate-400">Einddatum (optioneel)</p>
                  <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                  {recurrenceEndDate && (
                    <button onClick={() => setRecurrenceEndDate('')} className="text-xs text-slate-500">Geen einddatum</button>
                  )}
                </div>
              )}

              <Button onClick={() => setSheet('details')} fullWidth className="mt-2">Klaar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Weekkalender ──────────────────────────────────────────────────
function WeekKalender({ events }: { events: LifeEvent[] }) {
  const vandaag = new Date()
  const dagVandaag = vandaag.getDay()
  const maandag = new Date(vandaag)
  maandag.setDate(vandaag.getDate() - (dagVandaag === 0 ? 6 : dagVandaag - 1))
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(maandag); d.setDate(maandag.getDate() + i); return d })
  const feestdagen = getNederlandseFeestdagen(vandaag.getFullYear())
  const weekLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

  function getEventsVoorDag(dag: Date): LifeEvent[] {
    const dagStr = dag.toISOString().split('T')[0]
    const dagNummer = dag.getDay()
    return events.filter(event => {
      if (event.recurrence_end_date && dagStr > event.recurrence_end_date) return false
      if (event.type === 'vakantie' && event.end_date) {
        const start = new Date(event.start_time).toISOString().split('T')[0]
        return dagStr >= start && dagStr <= event.end_date
      }
      const eventDagStr = new Date(event.start_time).toISOString().split('T')[0]
      if (eventDagStr === dagStr) return true
      if (!event.recurrence) return false
      if (event.recurrence === 'workdays') return [1,2,3,4,5].includes(dagNummer)
      if (event.recurrence === 'weekend') return [0,6].includes(dagNummer)
      if (event.recurrence === 'daily') return true
      if (event.recurrence === 'weekly' || event.recurrence === 'biweekly') {
        const days = event.recurrence_days || [new Date(event.start_time).getDay()]
        if (!days.includes(dagNummer)) return false
        if (event.recurrence === 'biweekly') {
          const diffWeken = Math.round((dag.getTime() - new Date(event.start_time).getTime()) / (7 * 24 * 60 * 60 * 1000))
          return diffWeken % 2 === 0 && diffWeken >= 0
        }
        return true
      }
      if (event.recurrence === 'custom') return (event.recurrence_days || []).includes(dagNummer)
      return false
    })
  }

  const isVandaag = (d: Date) => d.toDateString() === vandaag.toDateString()
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6
  const getFeestdag = (d: Date) => feestdagen.find(f => f.date === d.toISOString().split('T')[0])

  const legendaTypes = Array.from(new Set(week.flatMap(d => getEventsVoorDag(d).map(e => e.type))))
  const legendaFeestdagen = week.map(d => getFeestdag(d)).filter(Boolean)

  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Deze week</p>
      <div className="grid grid-cols-7 gap-1 mb-3">
        {week.map((dag, i) => {
          const dagEvents = getEventsVoorDag(dag)
          const actief = isVandaag(dag)
          const weekend = isWeekend(dag)
          const feestdag = getFeestdag(dag)
          return (
            <div key={i} className={cn('flex flex-col items-center gap-0.5 rounded-xl py-2',
              actief ? 'bg-primary-500/20' : feestdag ? 'bg-yellow-500/10' : weekend ? 'bg-slate-800/40' : '')}>
              <p className={cn('text-xs', actief ? 'text-primary-400' : feestdag ? 'text-yellow-400' : weekend ? 'text-slate-600' : 'text-slate-500')}>
                {weekLabels[i]}
              </p>
              <p className={cn('text-sm font-bold', actief ? 'text-primary-400' : feestdag ? 'text-yellow-400' : weekend ? 'text-slate-500' : 'text-white')}>
                {dag.getDate()}
              </p>
              <div className="flex flex-col items-center">
                {feestdag && <span className="text-xs">{feestdag.icon}</span>}
                {dagEvents.slice(0, feestdag ? 1 : 2).map((event, j) => {
                  const et = EVENT_TYPES.find(e => e.type === event.type)
                  return <span key={j} className="text-xs leading-tight">{et?.icon || '📅'}</span>
                })}
                {!feestdag && dagEvents.length === 0 && <div className="h-4" />}
              </div>
            </div>
          )
        })}
      </div>

      {(legendaTypes.length > 0 || legendaFeestdagen.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-coach-border">
          {legendaFeestdagen.map((f, i) => (
            <span key={i} className="text-xs text-yellow-400">{f!.icon} {f!.name}</span>
          ))}
          {legendaTypes.map(type => {
            const et = EVENT_TYPES.find(e => e.type === type)
            return <span key={type} className="text-xs text-slate-400">{et?.icon} {et?.label}</span>
          })}
        </div>
      )}
    </Card>
  )
}

// ── Event Detail ──────────────────────────────────────────────────
function EventDetail({ event, onClose, onVerwijder, onUpdate }: {
  event: LifeEvent; onClose: () => void
  onVerwijder: (id: string) => void; onUpdate: (id: string, updates: Partial<LifeEvent>) => void
}) {
  const et = EVENT_TYPES.find(e => e.type === event.type)
  const [notes, setNotes] = useState(event.notes || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function slaOp() {
    setSaving(true)
    try {
      const res = await fetch('/api/life-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.id, notes: notes || null }),
      })
      const data = await res.json()
      if (data.success) {
        onUpdate(event.id, { notes })
        setMessage('✅ Opgeslagen')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch { setMessage('❌ Mislukt') } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{et?.icon} {et?.label || event.type}</h2>
          <p className="text-xs text-slate-500">
            {formatDatum(event.start_time)}
            {event.end_date && ` → ${formatDatum(event.end_date)}`}
          </p>
        </div>
        <button onClick={() => onVerwijder(event.id)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Trash2 size={16} className="text-red-400" />
        </button>
      </div>

      {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

      <Card className="p-4 flex flex-col gap-3">
        {event.start_hour !== null && event.end_hour !== null && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Tijden</p>
            <p className="text-sm text-white">{formatUur(event.start_hour)} – {formatUur(event.end_hour)}</p>
          </div>
        )}
        {event.recurrence && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Herhaling</p>
            <p className="text-sm text-white">{formatHerhaling(event)}</p>
          </div>
        )}
        {event.recurrence_end_date && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Tot</p>
            <p className="text-sm text-white">{formatDatum(event.recurrence_end_date)}</p>
          </div>
        )}
        {event.vacation_type && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Type</p>
            <p className="text-sm text-white">{event.vacation_type === 'actief' ? '🚵 Actief' : '🏖️ Ontspanning'}</p>
          </div>
        )}
      </Card>

      <div className="flex gap-2 flex-wrap">
        <ImpactBadge label="Herstel" value={event.recovery_impact} />
        <ImpactBadge label="Stress" value={event.stress_load} />
        <ImpactBadge label="Slaap" value={event.sleep_disruption} />
      </div>

      <Card className="p-4 flex flex-col gap-2">
        <label className="text-xs text-slate-400">Notitie</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra context..."
          className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
      </Card>

      <Button onClick={slaOp} loading={saving} fullWidth>Opslaan</Button>
    </div>
  )
}

// ── Hoofdpagina ───────────────────────────────────────────────────
export default function LifeEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [message, setMessage] = useState('')
  const [geselecteerde, setGeselecteerde] = useState<LifeEvent | null>(null)

  const vandaagStr = new Date().toISOString().split('T')[0]
  const feestdagen = getNederlandseFeestdagen(new Date().getFullYear())
  const vandaagFeestdag = feestdagen.find(f => f.date === vandaagStr)

  useEffect(() => { laadEvents() }, [])

  async function laadEvents() {
    setLoading(true)
    try {
      const res = await fetch('/api/life-events')
      const data = await res.json()
      setEvents(data.events || [])
    } catch { setEvents([]) } finally { setLoading(false) }
  }

  async function slaEventOp(eventData: Partial<LifeEvent>) {
    const res = await fetch('/api/life-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    })
    const data = await res.json()
    if (data.event) {
      setEvents(prev => [data.event, ...prev])
      setShowSheet(false)
      setMessage('✅ Event toegevoegd')
      setTimeout(() => setMessage(''), 2000)
    }
  }

  async function verwijder(id: string) {
    await fetch('/api/life-events?id=' + id, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
    setGeselecteerde(null)
  }

  function updateEvent(id: string, updates: Partial<LifeEvent>) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    if (geselecteerde?.id === id) setGeselecteerde(prev => prev ? { ...prev, ...updates } : null)
  }

  if (geselecteerde) {
    return (
      <AppShell showNav={false}>
        <div className="px-5 py-6">
          <EventDetail event={geselecteerde} onClose={() => setGeselecteerde(null)} onVerwijder={verwijder} onUpdate={updateEvent} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/settings')} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Levensgebeurtenissen</h1>
          <button onClick={() => setShowSheet(true)} className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center active:bg-primary-700">
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

        {vandaagFeestdag && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-yellow-400">{vandaagFeestdag.icon} Vandaag is het {vandaagFeestdag.name}</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">De coach houdt hier automatisch rekening mee</p>
          </div>
        )}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-400">De coach past je herstel- en trainingsadvies aan op basis van wat er in je leven speelt.</p>
        </div>

        {!loading && <WeekKalender events={events} />}

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Laatste 14 dagen</p>
          {loading ? (
            <div className="flex flex-col gap-2">{[1,2].map(i => <div key={i} className="h-16 rounded-2xl bg-coach-card animate-pulse" />)}</div>
          ) : events.length === 0 ? (
            <Card className="p-6 text-center">
              <Calendar size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Geen events geregistreerd</p>
              <button onClick={() => setShowSheet(true)} className="mt-3 text-xs text-primary-400">+ Voeg toe</button>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map(event => {
                const et = EVENT_TYPES.find(e => e.type === event.type)
                return (
                  <button key={event.id} onClick={() => setGeselecteerde(event)} className="w-full text-left">
                    <Card className="p-4 active:bg-slate-700">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{et?.icon || '📅'}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-white text-sm font-medium">{et?.label || event.type}</p>
                            {event.recurrence && <span className="text-xs text-primary-400">{formatHerhaling(event)}</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDatum(event.start_time)}
                            {event.end_date && ` → ${new Date(event.end_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`}
                            {event.start_hour !== null && event.end_hour !== null && ` · ${formatUur(event.start_hour)}–${formatUur(event.end_hour)}`}
                          </p>
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            <ImpactBadge label="Herstel" value={event.recovery_impact} />
                            <ImpactBadge label="Stress" value={event.stress_load} />
                            <ImpactBadge label="Slaap" value={event.sleep_disruption} />
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 flex-shrink-0" />
                      </div>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showSheet && (
        <NieuwEventSheet onClose={() => setShowSheet(false)} onSave={slaEventOp} />
      )}
    </AppShell>
  )
}
