'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Calendar, ChevronDown } from 'lucide-react'
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

// Nederlandse feestdagen
function getNederlandseFeestdagen(jaar: number): HolidayEvent[] {
  // Pasen berekening
  const a = jaar % 19
  const b = Math.floor(jaar / 100)
  const c = jaar % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const maand = Math.floor((h + l - 7 * m + 114) / 31)
  const dag = ((h + l - 7 * m + 114) % 31) + 1
  const pasen = new Date(jaar, maand - 1, dag)

  const goedVrijdag = new Date(pasen); goedVrijdag.setDate(pasen.getDate() - 2)
  const paasMaandag = new Date(pasen); paasMaandag.setDate(pasen.getDate() + 1)
  const hemelvaartsdag = new Date(pasen); hemelvaartsdag.setDate(pasen.getDate() + 39)
  const pinksteren = new Date(pasen); pinksteren.setDate(pasen.getDate() + 49)
  const pinksterMaandag = new Date(pasen); pinksterMaandag.setDate(pasen.getDate() + 50)

  const toStr = (d: Date) => d.toISOString().split('T')[0]

  return [
    { date: `${jaar}-01-01`, name: 'Nieuwjaarsdag', icon: '🎆' },
    { date: toStr(goedVrijdag), name: 'Goede Vrijdag', icon: '✝️' },
    { date: toStr(pasen), name: 'Eerste Paasdag', icon: '🐣' },
    { date: toStr(paasMaandag), name: 'Tweede Paasdag', icon: '🐣' },
    { date: `${jaar}-04-27`, name: 'Koningsdag', icon: '👑' },
    { date: `${jaar}-05-05`, name: 'Bevrijdingsdag', icon: '🕊️' },
    { date: toStr(hemelvaartsdag), name: 'Hemelvaartsdag', icon: '☁️' },
    { date: toStr(pinksteren), name: 'Eerste Pinksterdag', icon: '🕊️' },
    { date: toStr(pinksterMaandag), name: 'Tweede Pinksterdag', icon: '🕊️' },
    { date: `${jaar}-12-25`, name: 'Eerste Kerstdag', icon: '🎄' },
    { date: `${jaar}-12-26`, name: 'Tweede Kerstdag', icon: '🎄' },
  ]
}

const EVENT_CATEGORIES = [
  {
    label: 'Werk',
    events: [
      { type: 'nachtdienst', label: 'Nachtdienst', icon: '🌙', start_hour: 22, end_hour: 6, recovery_impact: 2, stress_load: 1, sleep_disruption: 3 },
      { type: 'avonddienst', label: 'Avonddienst', icon: '🌆', start_hour: 14, end_hour: 1, recovery_impact: 1, stress_load: 1, sleep_disruption: 2 },
      { type: 'vroege_dienst', label: 'Vroege dienst', icon: '🌅', start_hour: 6, end_hour: 15, recovery_impact: 1, stress_load: 1, sleep_disruption: 2 },
      { type: 'dagdienst', label: 'Dagdienst', icon: '☀️', start_hour: 9, end_hour: 17, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
      { type: 'thuiswerken', label: 'Thuiswerken', icon: '🏠', start_hour: 9, end_hour: 17, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
      { type: 'lange_dag', label: 'Lange dag / overwerk', icon: '⏰', start_hour: 8, end_hour: 20, recovery_impact: 1, stress_load: 2, sleep_disruption: 1 },
      { type: 'vrije_dag', label: 'Vrije dag', icon: '🗓️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
      { type: 'werk_stress', label: 'Werkstress', icon: '💼', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 3, sleep_disruption: 1 },
    ]
  },
  {
    label: 'Leven',
    events: [
      { type: 'vakantie', label: 'Vakantie', icon: '🏖️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 1 },
      { type: 'reizen', label: 'Reizen', icon: '✈️', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 1 },
      { type: 'feest', label: 'Feest / Late avond', icon: '🎉', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 0, sleep_disruption: 2 },
      { type: 'sociaal', label: 'Familiebezoek / sociaal', icon: '👨‍👩‍👧', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 1, sleep_disruption: 0 },
      { type: 'jetlag', label: 'Jetlag / tijdzone', icon: '🌍', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 3 },
    ]
  },
  {
    label: 'Gezondheid',
    events: [
      { type: 'ziek', label: 'Ziek', icon: '🤒', start_hour: null, end_hour: null, recovery_impact: 3, stress_load: 1, sleep_disruption: 2 },
      { type: 'emotionele_stress', label: 'Emotionele stress', icon: '😔', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 3, sleep_disruption: 2 },
      { type: 'slecht_geslapen', label: 'Slecht geslapen', icon: '😴', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 0, sleep_disruption: 3 },
      { type: 'hersteldag', label: 'Hersteldag', icon: '🛋️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    ]
  },
  {
    label: 'Omgeving',
    events: [
      { type: 'extreme_hitte', label: 'Extreme hitte', icon: '🌡️', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 1 },
    ]
  },
]

// Flat lijst voor lookups
const EVENT_TYPES = EVENT_CATEGORIES.flatMap(c => c.events)

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Eenmalig' },
  { value: 'daily', label: 'Dagelijks' },
  { value: 'workdays', label: 'Werkdagen' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'weekly', label: 'Wekelijks', needsDay: true },
  { value: 'biweekly', label: 'Om de week', needsDay: true },
  { value: 'custom', label: 'Aangepast', needsDays: true },
]

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Dagelijks', workdays: 'Werkdagen', weekend: 'Weekend',
  weekly: 'Wekelijks', biweekly: 'Om de week', custom: 'Aangepast',
}

const DAGEN = [
  { label: 'Ma', nummer: 1 }, { label: 'Di', nummer: 2 },
  { label: 'Wo', nummer: 3 }, { label: 'Do', nummer: 4 },
  { label: 'Vr', nummer: 5 }, { label: 'Za', nummer: 6 },
  { label: 'Zo', nummer: 0 },
]

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

function HerhalingSelector({ recurrence, setRecurrence, recurrenceDays, setRecurrenceDays, recurrenceEndDate, setRecurrenceEndDate }: {
  recurrence: string; setRecurrence: (v: string) => void
  recurrenceDays: number[]; setRecurrenceDays: (v: number[]) => void
  recurrenceEndDate: string; setRecurrenceEndDate: (v: string) => void
}) {
  function toggleDag(nummer: number) {
    setRecurrenceDays(recurrenceDays.includes(nummer) ? recurrenceDays.filter(d => d !== nummer) : [...recurrenceDays, nummer])
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs text-slate-400">Herhaling</label>
      <div className="grid grid-cols-2 gap-2">
        {RECURRENCE_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => {
            setRecurrence(opt.value)
            if (opt.value === 'workdays') setRecurrenceDays([1,2,3,4,5])
            else if (opt.value === 'weekend') setRecurrenceDays([6,0])
            else if (!opt.needsDay && !opt.needsDays) setRecurrenceDays([])
          }}
            className={cn('px-3 py-2.5 rounded-xl text-sm font-medium text-center',
              recurrence === opt.value ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 active:bg-slate-700')}>
            {opt.label}
          </button>
        ))}
      </div>

      {(recurrence === 'weekly' || recurrence === 'biweekly') && (
        <div>
          <label className="text-xs text-slate-400 mb-2 block">Op welke dag?</label>
          <div className="flex gap-1.5">
            {DAGEN.map(dag => (
              <button key={dag.nummer} onClick={() => setRecurrenceDays([dag.nummer])}
                className={cn('flex-1 py-2 rounded-xl text-xs font-medium',
                  recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                {dag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {recurrence === 'custom' && (
        <div>
          <label className="text-xs text-slate-400 mb-2 block">Welke dagen?</label>
          <div className="flex gap-1.5">
            {DAGEN.map(dag => (
              <button key={dag.nummer} onClick={() => toggleDag(dag.nummer)}
                className={cn('flex-1 py-2 rounded-xl text-xs font-medium',
                  recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                {dag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {recurrence !== '' && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Einddatum (optioneel)</label>
          <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          {recurrenceEndDate && (
            <button onClick={() => setRecurrenceEndDate('')} className="text-xs text-slate-500 mt-1">Geen einddatum</button>
          )}
        </div>
      )}
    </div>
  )
}

function WeekKalender({ events }: { events: LifeEvent[] }) {
  const vandaag = new Date()
  const dagVandaag = vandaag.getDay()
  const maandag = new Date(vandaag)
  maandag.setDate(vandaag.getDate() - (dagVandaag === 0 ? 6 : dagVandaag - 1))

  const week = Array.from({ length: 7 }, (_, i) => {
    const dag = new Date(maandag)
    dag.setDate(maandag.getDate() + i)
    return dag
  })

  const feestdagen = getNederlandseFeestdagen(vandaag.getFullYear())
  const weekLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

  function getEventsVoorDag(dag: Date): LifeEvent[] {
    const dagStr = dag.toISOString().split('T')[0]
    const dagNummer = dag.getDay()

    return events.filter(event => {
      if (event.recurrence_end_date && dagStr > event.recurrence_end_date) return false

      // Vakantie periode
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
      if (event.recurrence === 'weekly') {
        const days = event.recurrence_days || [new Date(event.start_time).getDay()]
        return days.includes(dagNummer)
      }
      if (event.recurrence === 'biweekly') {
        const days = event.recurrence_days || [new Date(event.start_time).getDay()]
        if (!days.includes(dagNummer)) return false
        const diffMs = dag.getTime() - new Date(event.start_time).getTime()
        const diffWeken = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
        return diffWeken % 2 === 0 && diffWeken >= 0
      }
      if (event.recurrence === 'custom') {
        return (event.recurrence_days || []).includes(dagNummer)
      }
      return false
    })
  }

  const isVandaag = (dag: Date) => dag.toDateString() === vandaag.toDateString()
  const isWeekend = (dag: Date) => dag.getDay() === 0 || dag.getDay() === 6
  const getFeestdag = (dag: Date) => feestdagen.find(f => f.date === dag.toISOString().split('T')[0])

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500 uppercase tracking-wider px-1">Deze week</p>
      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {week.map((dag, i) => {
            const dagEvents = getEventsVoorDag(dag)
            const actief = isVandaag(dag)
            const weekend = isWeekend(dag)
            const feestdag = getFeestdag(dag)

            return (
              <div key={i} className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl py-2 px-0.5',
                actief ? 'bg-primary-500/20' : weekend ? 'bg-slate-800/30' : feestdag ? 'bg-yellow-500/10' : ''
              )}>
                <p className={cn('text-xs font-medium', actief ? 'text-primary-400' : weekend ? 'text-slate-500' : feestdag ? 'text-yellow-400' : 'text-slate-400')}>
                  {weekLabels[i]}
                </p>
                <p className={cn('text-sm font-bold', actief ? 'text-primary-400' : weekend ? 'text-slate-500' : feestdag ? 'text-yellow-400' : 'text-white')}>
                  {dag.getDate()}
                </p>
                <div className="flex flex-col items-center gap-0.5">
                  {feestdag && <span className="text-xs leading-none">{feestdag.icon}</span>}
                  {dagEvents.slice(0, feestdag ? 1 : 2).map((event, j) => {
                    const et = EVENT_TYPES.find(e => e.type === event.type)
                    return <span key={j} className="text-xs leading-none">{et?.icon || '📅'}</span>
                  })}
                  {!feestdag && dagEvents.length === 0 && <div className="h-4" />}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legenda */}
        {(week.some(dag => getEventsVoorDag(dag).length > 0) || week.some(dag => getFeestdag(dag))) && (
          <div className="mt-3 pt-3 border-t border-coach-border flex flex-wrap gap-3">
            {week.map(dag => getFeestdag(dag)).filter(Boolean).map((f, i) => (
              <span key={i} className="text-xs text-yellow-400 flex items-center gap-1">{f!.icon} {f!.name}</span>
            ))}
            {Array.from(new Set(week.flatMap(dag => getEventsVoorDag(dag).map(e => e.type)))).map(type => {
              const et = EVENT_TYPES.find(e => e.type === type)
              return <span key={type} className="text-xs text-slate-400 flex items-center gap-1">{et?.icon} {et?.label}</span>
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function EventDetail({ event, onClose, onVerwijder, onUpdate }: {
  event: LifeEvent; onClose: () => void
  onVerwijder: (id: string) => void; onUpdate: (id: string, updates: Partial<LifeEvent>) => void
}) {
  const et = EVENT_TYPES.find(e => e.type === event.type)
  const [notes, setNotes] = useState(event.notes || '')
  const [startHour, setStartHour] = useState(event.start_hour ?? et?.start_hour ?? null)
  const [endHour, setEndHour] = useState(event.end_hour ?? et?.end_hour ?? null)
  const [recurrence, setRecurrence] = useState(event.recurrence || '')
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(event.recurrence_days || [])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(event.recurrence_end_date || '')
  const [endDate, setEndDate] = useState(event.end_date || '')
  const [vacationType, setVacationType] = useState(event.vacation_type || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function slaOp() {
    setSaving(true)
    try {
      const res = await fetch('/api/life-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: event.id, notes: notes || null,
          start_hour: startHour, end_hour: endHour,
          recurrence: recurrence || null,
          recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
          recurrence_end_date: recurrenceEndDate || null,
          end_date: endDate || null,
          vacation_type: vacationType || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onUpdate(event.id, { notes, start_hour: startHour, end_hour: endHour, recurrence, recurrence_days: recurrenceDays, recurrence_end_date: recurrenceEndDate, end_date: endDate, vacation_type: vacationType })
        setMessage('✅ Opgeslagen')
        setTimeout(() => setMessage(''), 2000)
      } else {
        setMessage('❌ ' + (data.error || 'Mislukt'))
      }
    } catch {
      setMessage('❌ Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{et?.icon} {et?.label || event.type}</h2>
          <p className="text-xs text-slate-500">{formatDatum(event.start_time)}</p>
        </div>
        <button onClick={() => onVerwijder(event.id)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Trash2 size={16} className="text-red-400" />
        </button>
      </div>

      {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

      {event.type === 'vakantie' ? (
        <Card className="p-4 flex flex-col gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Einddatum vakantie</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Type vakantie</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: 'actief', label: '🚵 Actief', sub: 'wandelen, fietsen' }, { value: 'ontspanning', label: '🏖️ Ontspanning', sub: 'strand, city trip' }].map(opt => (
                <button key={opt.value} onClick={() => setVacationType(opt.value)}
                  className={cn('p-3 rounded-xl text-left', vacationType === opt.value ? 'bg-primary-600' : 'bg-slate-800')}>
                  <p className="text-sm font-medium text-white">{opt.label}</p>
                  <p className="text-xs text-slate-400">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <>
          {et?.start_hour !== null && (
            <Card className="p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-white">Tijden</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Begintijd</label>
                  <select value={startHour ?? ''} onChange={e => setStartHour(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="">—</option>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Eindtijd</label>
                  <select value={endHour ?? ''} onChange={e => setEndHour(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="">—</option>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
              </div>
            </Card>
          )}
          <Card className="p-4">
            <HerhalingSelector recurrence={recurrence} setRecurrence={setRecurrence}
              recurrenceDays={recurrenceDays} setRecurrenceDays={setRecurrenceDays}
              recurrenceEndDate={recurrenceEndDate} setRecurrenceEndDate={setRecurrenceEndDate} />
          </Card>
        </>
      )}

      <Card className="p-4 flex flex-col gap-2">
        <label className="text-xs text-slate-400">Notitie (optioneel)</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra context..."
          className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
      </Card>

      <div className="flex gap-2 flex-wrap">
        <ImpactBadge label="Herstel" value={event.recovery_impact} />
        <ImpactBadge label="Stress" value={event.stress_load} />
        <ImpactBadge label="Slaap" value={event.sleep_disruption} />
      </div>

      <Button onClick={slaOp} loading={saving} fullWidth>Opslaan</Button>
    </div>
  )
}

export default function LifeEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showNieuw, setShowNieuw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [geselecteerde, setGeselecteerde] = useState<LifeEvent | null>(null)
  const [geselecteerdType, setGeselecteerdType] = useState<typeof EVENT_TYPES[0] | null>(null)
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16))
  const [startHour, setStartHour] = useState<number | null>(null)
  const [endHour, setEndHour] = useState<number | null>(null)
  const [endDate, setEndDate] = useState('')
  const [vacationType, setVacationType] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => { laadEvents() }, [])

  async function laadEvents() {
    setLoading(true)
    try {
      const res = await fetch('/api/life-events')
      const data = await res.json()
      setEvents(data.events || [])
    } catch { setEvents([]) } finally { setLoading(false) }
  }

  function selecteerType(et: typeof EVENT_TYPES[0]) {
    setGeselecteerdType(et)
    setStartHour(et.start_hour)
    setEndHour(et.end_hour)
    setRecurrence('')
    setRecurrenceDays([])
    setEndDate('')
    setVacationType('')
  }

  async function voegToe() {
    if (!geselecteerdType) return
    setSaving(true)
    try {
      const res = await fetch('/api/life-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: geselecteerdType.type,
          start_time: new Date(startTime).toISOString(),
          recovery_impact: geselecteerdType.recovery_impact,
          stress_load: geselecteerdType.stress_load,
          sleep_disruption: geselecteerdType.sleep_disruption,
          start_hour: startHour,
          end_hour: endHour,
          recurrence: recurrence || null,
          recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
          recurrence_end_date: recurrenceEndDate || null,
          end_date: endDate || null,
          vacation_type: vacationType || null,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (data.event) {
        setEvents(prev => [data.event, ...prev])
        setShowNieuw(false)
        setGeselecteerdType(null)
        setNotes(''); setRecurrence(''); setRecurrenceDays([])
        setRecurrenceEndDate(''); setEndDate(''); setVacationType('')
        setMessage('✅ Event toegevoegd')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch { setMessage('❌ Toevoegen mislukt') } finally { setSaving(false) }
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

  const vandaagFeestdagen = getNederlandseFeestdagen(new Date().getFullYear())
    .filter(f => f.date === new Date().toISOString().split('T')[0])

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
          <button onClick={() => router.push('/settings')} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Levensgebeurtenissen</h1>
          <button onClick={() => setShowNieuw(true)} className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center active:bg-primary-700">
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

        {vandaagFeestdagen.map(f => (
          <div key={f.date} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-yellow-400">{f.icon} Vandaag is het {f.name} — de coach houdt hier rekening mee</p>
          </div>
        ))}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-400">De coach past je herstel- en trainingsadvies aan op basis van wat er in je leven speelt.</p>
        </div>

        {!loading && <WeekKalender events={events} />}

        {showNieuw && (
          <Card className="p-4 flex flex-col gap-4">
            <p className="text-sm font-semibold text-white">Wat speelt er?</p>

            {EVENT_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{cat.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {cat.events.map(et => (
                    <button key={et.type} onClick={() => selecteerType(et)}
                      className={cn('flex items-center gap-2 px-3 py-3 rounded-xl text-left',
                        geselecteerdType?.type === et.type ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-300 active:bg-slate-700')}>
                      <span className="text-lg">{et.icon}</span>
                      <span className="text-xs font-medium">{et.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {geselecteerdType && (
              <>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Startdatum</label>
                  <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>

                {geselecteerdType.type === 'vakantie' ? (
                  <>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Einddatum vakantie</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-2 block">Type vakantie</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ value: 'actief', label: '🚵 Actief', sub: 'wandelen, fietsen' }, { value: 'ontspanning', label: '🏖️ Ontspanning', sub: 'strand, city trip' }].map(opt => (
                          <button key={opt.value} onClick={() => setVacationType(opt.value)}
                            className={cn('p-3 rounded-xl text-left', vacationType === opt.value ? 'bg-primary-600' : 'bg-slate-800')}>
                            <p className="text-sm font-medium text-white">{opt.label}</p>
                            <p className="text-xs text-slate-400">{opt.sub}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {geselecteerdType.start_hour !== null && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Begintijd</label>
                          <select value={startHour ?? ''} onChange={e => setStartHour(Number(e.target.value))}
                            className="w-full bg-slate-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Eindtijd</label>
                          <select value={endHour ?? ''} onChange={e => setEndHour(Number(e.target.value))}
                            className="w-full bg-slate-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                    <HerhalingSelector recurrence={recurrence} setRecurrence={setRecurrence}
                      recurrenceDays={recurrenceDays} setRecurrenceDays={setRecurrenceDays}
                      recurrenceEndDate={recurrenceEndDate} setRecurrenceEndDate={setRecurrenceEndDate} />
                  </>
                )}

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Notitie (optioneel)</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra context..."
                    className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={voegToe} loading={saving} fullWidth size="sm" disabled={!geselecteerdType}>Opslaan</Button>
              <button onClick={() => { setShowNieuw(false); setGeselecteerdType(null) }}
                className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm">Annuleer</button>
            </div>
          </Card>
        )}

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Laatste 14 dagen</p>
          {loading ? (
            <div className="flex flex-col gap-2">{[1,2].map(i => <div key={i} className="h-16 rounded-2xl bg-coach-card animate-pulse" />)}</div>
          ) : events.length === 0 ? (
            <Card className="p-6 text-center">
              <Calendar size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Geen events geregistreerd</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map(event => {
                const et = EVENT_TYPES.find(e => e.type === event.type)
                return (
                  <button key={event.id} onClick={() => setGeselecteerde(event)} className="w-full text-left">
                    <Card className="p-4 active:bg-slate-700">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{et?.icon || '📅'}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-white text-sm font-medium">{et?.label || event.type}</p>
                            {event.recurrence && <span className="text-xs text-primary-400">{formatHerhaling(event)}</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDatum(event.start_time)}
                            {event.end_date && <span> → {new Date(event.end_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>}
                            {event.start_hour !== null && event.end_hour !== null && <span> · {formatUur(event.start_hour)} – {formatUur(event.end_hour)}</span>}
                            {event.recurrence_end_date && <span className="text-slate-600"> · tot {new Date(event.recurrence_end_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>}
                          </p>
                          {event.vacation_type && <p className="text-xs text-blue-400 mt-0.5">{event.vacation_type === 'actief' ? '🚵 Actieve vakantie' : '🏖️ Ontspanning'}</p>}
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <ImpactBadge label="Herstel" value={event.recovery_impact} />
                            <ImpactBadge label="Stress" value={event.stress_load} />
                            <ImpactBadge label="Slaap" value={event.sleep_disruption} />
                          </div>
                          {event.notes && <p className="text-xs text-slate-400 mt-1">{event.notes}</p>}
                        </div>
                        <ChevronDown size={16} className="text-slate-600 -rotate-90 flex-shrink-0 mt-1" />
                      </div>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
