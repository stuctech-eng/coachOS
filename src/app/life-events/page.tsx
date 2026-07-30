'use client'
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Plus, Trash2, Calendar, ChevronLeft, ChevronRight, X, Check, Sparkles } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { cn } from '@/utils'
import Link from 'next/link'
import { getNederlandseFeestdagen, type HolidayEvent } from '@/lib/feestdagen'

// ── Levensgebeurtenissen — Coach Context, Fase 1 UI ─────────────────────
// Bron: overleg 22 juli 2026. Belangrijkste verandering: dit scherm is
// niet langer alleen een registratiepagina, maar een venster naar de
// Context Resolver — het toont wat de Coach daadwerkelijk ziet en
// waarom, in plaats van losse events die je zelf moet interpreteren.
//
// Architectuurregel (bewust bewaakt): dit formulier bepaalt NOOIT de
// intelligentie (trainingModifier/-30% etc.) — dat blijft exclusief bij
// de Context Resolver, afgeleid van de MODUS. Wat de gebruiker hier wél
// instelt zijn de ruwe impact-scores (herstel/stress/slaap, 0-3) die in
// lifeEventPenalty terechtkomen — in vriendelijke taal, niet als kale
// cijfers.

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
  // v2.4.185 (Coach Agenda Fase A): puur additieve contextvelden
  available_time_minutes: number | null
  priority: 'laag' | 'normaal' | 'hoog' | null
  coach_note: string | null
  location_type: string | null
  energy_expectation: string | null
  travel_distance_km: number | null
  recurrence_exceptions: string[] | null
}

interface ResolvedContext {
  lifeContext: {
    mode: string
    priorityReason: string
    coachInstruction: string
    suppressedEvents: { type: string; status: string; reason: string }[]
  }
  healthContext: { activeInjuries: boolean; injuryDetails: { body_part: string; pain_score: number }[] }
  trainingImpact: { trainingModifier: number; recoveryModifier: number; stressModifier: number }
  lifeEventPenalty: number
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
    // v2.4.185 (Coach Agenda Fase A)
    { type: 'consignatie', label: 'Consignatie (bereikbaarheidsdienst)', icon: '📟', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 1, sleep_disruption: 1 },
  ]},
  { id: 'leven', label: 'Leven', icon: '🌍', events: [
    { type: 'vakantie', label: 'Vakantie', icon: '🏖️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 1 },
    { type: 'reizen', label: 'Reizen', icon: '✈️', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 1 },
    { type: 'feest', label: 'Feest / Late avond', icon: '🎉', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 0, sleep_disruption: 2 },
    { type: 'sociaal', label: 'Familie / sociaal', icon: '👨‍👩‍👧', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 1, sleep_disruption: 0 },
    { type: 'jetlag', label: 'Jetlag', icon: '🌍', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 3 },
    // v2.4.185 (Coach Agenda Fase A) — Privé + Reizen, verder uitgesplitst
    { type: 'verjaardag', label: 'Verjaardag', icon: '🎂', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    { type: 'bruiloft', label: 'Bruiloft', icon: '💍', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 1 },
    { type: 'begrafenis', label: 'Begrafenis', icon: '🕊️', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 2, sleep_disruption: 0 },
    { type: 'weekend_weg', label: 'Weekend weg', icon: '🧳', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 1 },
    { type: 'zakenreis', label: 'Zakenreis', icon: '💼', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 1, sleep_disruption: 1 },
    { type: 'lange_autorit', label: 'Lange autorit', icon: '🚗', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 0 },
    { type: 'vlucht', label: 'Vlucht', icon: '🛫', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 1, sleep_disruption: 1 },
    { type: 'hotel', label: 'Hotel', icon: '🏨', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 1 },
  ]},
  { id: 'gezondheid', label: 'Gezondheid', icon: '❤️', events: [
    { type: 'ziek', label: 'Ziek', icon: '🤒', start_hour: null, end_hour: null, recovery_impact: 3, stress_load: 1, sleep_disruption: 2 },
    { type: 'emotionele_stress', label: 'Emotionele stress', icon: '😔', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 3, sleep_disruption: 2 },
    { type: 'slecht_geslapen', label: 'Slecht geslapen', icon: '😴', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 0, sleep_disruption: 3 },
    { type: 'hersteldag', label: 'Hersteldag', icon: '🛋️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
  ]},
  // v2.4.185 (Coach Agenda Fase A) — nieuwe categorie, was voorheen niet
  // te onderscheiden van een algemene 'ziek'-melding
  { id: 'medisch', label: 'Medisch', icon: '🏥', events: [
    { type: 'huisarts', label: 'Huisarts', icon: '🩺', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 1, sleep_disruption: 0 },
    { type: 'fysiotherapeut', label: 'Fysiotherapeut', icon: '🦵', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    { type: 'sportarts', label: 'Sportarts', icon: '🏃‍♂️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    { type: 'specialist', label: 'Specialist', icon: '👨‍⚕️', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 1, sleep_disruption: 0 },
    { type: 'massage', label: 'Massage', icon: '💆', start_hour: null, end_hour: null, recovery_impact: 0, stress_load: 0, sleep_disruption: 0 },
    { type: 'medisch_onderzoek', label: 'Medisch onderzoek', icon: '🔬', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 1, sleep_disruption: 0 },
    { type: 'vaccinatie', label: 'Vaccinatie', icon: '💉', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 0 },
  ]},
  // v2.4.185 (Coach Agenda Fase A) — nieuwe categorie voor sport-events
  // die geen reguliere training zijn (dus los van het trainingsplan)
  { id: 'sport', label: 'Sport', icon: '🚴', events: [
    { type: 'trainingskamp', label: 'Trainingskamp', icon: '⛰️', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 0, sleep_disruption: 1 },
    { type: 'testdag', label: 'Testdag (FTP/tijdrit/etc.)', icon: '⏱️', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 0 },
    { type: 'clubrit', label: 'Clubrit', icon: '🚴‍♂️', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 0 },
    { type: 'evenement', label: 'Evenement (toertocht e.d.)', icon: '🏁', start_hour: null, end_hour: null, recovery_impact: 2, stress_load: 1, sleep_disruption: 0 },
  ]},
  { id: 'omgeving', label: 'Omgeving', icon: '🌡️', events: [
    { type: 'extreme_hitte', label: 'Extreme hitte', icon: '🌡️', start_hour: null, end_hour: null, recovery_impact: 1, stress_load: 0, sleep_disruption: 1 },
  ]},
]

const EVENT_TYPES = EVENT_CATEGORIES.flatMap(c => c.events)

const MODE_LABELS: Record<string, { label: string; icon: string }> = {
  blessure: { label: 'Blessuremodus', icon: '🩹' },
  ziekte: { label: 'Ziektemodus', icon: '🤒' },
  vakantie: { label: 'Vakantiemodus', icon: '🏖️' },
  herstel: { label: 'Herstelmodus', icon: '🛋️' },
  wedstrijd: { label: 'Wedstrijdmodus', icon: '🏆' },
  werk: { label: 'Werkmodus', icon: '💼' },
  training: { label: 'Trainingsmodus', icon: '🏋️' },
  vrije_tijd: { label: 'Vrije tijd', icon: '🗓️' },
  normaal: { label: 'Normale dag', icon: '✓' },
}

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

// Vriendelijke labels voor de 0-3-impactschaal — geen kale cijfers
const IMPACT_NIVEAUS = ['Geen', 'Licht', 'Matig', 'Zwaar']

function formatUur(uur: number | null): string {
  if (uur === null) return ''
  return `${String(uur).padStart(2, '0')}:00`
}

function vandaagStr(): string { return new Date().toISOString().split('T')[0] }

function formatDatum(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatDatumKort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
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

// Is dit eenmalige (niet-terugkerende) event vandaag actief? Gebruikt
// nu start_date/end_date generiek voor ELK type — was voorheen
// hardcoded op alleen type==='vakantie' (v2.4.173-fix)
function isEenmaligActiefVandaag(event: LifeEvent, dagStr: string): boolean {
  const startDatum = event.start_time.split('T')[0]
  const eindDatum = event.end_date || startDatum
  return dagStr >= startDatum && dagStr <= eindDatum
}

function isHerhalendActiefOpDag(event: LifeEvent, datum: Date): boolean {
  if (!event.recurrence) return false
  const dagNummer = datum.getDay()
  const isWeekend = dagNummer === 0 || dagNummer === 6
  const dagStr = datum.toISOString().split('T')[0]
  // v2.4.185 (Coach Agenda Fase A): uitzonderingen eerst checken
  if (event.recurrence_exceptions?.includes(dagStr)) return false
  if (event.recurrence_end_date && dagStr > event.recurrence_end_date) return false
  if (event.recurrence === 'workdays') return !isWeekend
  if (event.recurrence === 'weekend') return isWeekend
  if (event.recurrence === 'weekly' || event.recurrence === 'biweekly' || event.recurrence === 'custom') {
    return event.recurrence_days ? event.recurrence_days.includes(dagNummer) : true
  }
  return true // daily
}

function ImpactBadge({ label, value }: { label: string; value: number }) {
  if (value === 0) return null
  const kleur = value >= 3 ? 'text-red-400 bg-red-500/10' : value >= 2 ? 'text-orange-400 bg-orange-500/10' : 'text-yellow-400 bg-yellow-500/10'
  return <span className={`text-xs px-2 py-0.5 rounded-full ${kleur}`}>{label}: {IMPACT_NIVEAUS[value]}</span>
}

// ── Statuskaart — venster naar de Context Resolver ──────────────────────
function ContextStatusKaart({ context }: { context: ResolvedContext | null }) {
  if (!context) return null
  const { mode, priorityReason, coachInstruction, suppressedEvents } = context.lifeContext
  const { trainingModifier, recoveryModifier, stressModifier } = context.trainingImpact
  const modeInfo = MODE_LABELS[mode] || MODE_LABELS.normaal

  if (mode === 'normaal' && !context.healthContext.activeInjuries) {
    return (
      <Card className="p-4 flex items-center gap-3">
        <span className="text-2xl">✓</span>
        <div>
          <p className="text-sm font-semibold text-white">Normale dag</p>
          <p className="text-xs text-slate-500">Geen bijzondere levensgebeurtenissen — CoachOS gebruikt je gewone trainingsadvies.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5 bg-gradient-to-br from-primary-500/10 to-transparent border-primary-500/20">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{modeInfo.icon}</span>
        <p className="text-base font-bold text-white">{modeInfo.label} actief</p>
      </div>
      <p className="text-xs text-slate-400 mb-3">{priorityReason}</p>

      {(trainingModifier !== 0 || recoveryModifier !== 0 || stressModifier !== 0) && (
        <div className="flex flex-col gap-1.5 mb-3">
          {trainingModifier !== 0 && (
            <p className="text-xs text-slate-300">✓ Training {trainingModifier > 0 ? 'zwaarder' : 'lichter'} plannen ({trainingModifier > 0 ? '+' : ''}{trainingModifier}%)</p>
          )}
          {recoveryModifier !== 0 && (
            <p className="text-xs text-slate-300">✓ {recoveryModifier > 0 ? 'Meer' : 'Minder'} herstelruimte ({recoveryModifier > 0 ? '+' : ''}{recoveryModifier}%)</p>
          )}
          {stressModifier !== 0 && (
            <p className="text-xs text-slate-300">✓ {stressModifier < 0 ? 'Minder' : 'Meer'} stress-aanname ({stressModifier > 0 ? '+' : ''}{stressModifier}%)</p>
          )}
        </div>
      )}

      {suppressedEvents.length > 0 && (
        <div className="mb-3 p-2.5 bg-slate-800/50 rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tijdelijk gepauzeerd</p>
          {suppressedEvents.map((e, i) => {
            const et = EVENT_TYPES.find(t => t.type === e.type)
            return <p key={i} className="text-xs text-slate-400">{et?.icon || '📅'} {et?.label || e.type} — {e.reason}</p>
          })}
        </div>
      )}

      {coachInstruction && (
        <div className="pt-3 border-t border-white/10">
          <p className="text-[10px] text-primary-400 uppercase tracking-wider mb-1">Coach-advies</p>
          <p className="text-sm text-slate-200">{coachInstruction}</p>
        </div>
      )}
    </Card>
  )
}

// ── AI-invoer — Coach Agenda Fase B ──────────────────────────────────
// Bron: overleg 30 juli 2026. NIET-ONDERHANDELBAAR: deze component slaat
// NOOIT rechtstreeks iets op. Ze roept alleen /api/life-events/parse aan
// (dat zelf ook niets opslaat) en toont een verplichte bevestigingskaart.
// Pas na een expliciete tik op "✓ Opslaan" gaat de data naar de
// bestaande, al-geteste onSave-functie — exact dezelfde weg als het
// handmatige formulier.
interface AiVoorstel {
  gelukt: boolean
  type?: string
  start_datum?: string
  start_uur?: number | null
  eind_uur?: number | null
  recurrence?: string | null
  recurrence_dagen?: number[] | null
  eind_datum?: string | null
  prioriteit?: string | null
  beschikbare_tijd_minuten?: number | null
  notitie?: string | null
  samenvatting?: string
  reden_mislukt?: string
}

function AiInvoerKaart({ onSave }: { onSave: (event: Partial<LifeEvent>) => Promise<void> }) {
  const [tekst, setTekst] = useState('')
  const [bezig, setBezig] = useState(false)
  const [voorstel, setVoorstel] = useState<AiVoorstel | null>(null)
  const [opslaanBezig, setOpslaanBezig] = useState(false)

  async function verstuur() {
    if (!tekst.trim()) return
    setBezig(true)
    setVoorstel(null)
    try {
      const res = await fetch('/api/life-events/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tekst }),
      })
      const data: AiVoorstel = await res.json()
      setVoorstel(data)
    } catch {
      setVoorstel({ gelukt: false, reden_mislukt: 'Verbindingsfout — probeer het opnieuw.' })
    } finally {
      setBezig(false)
    }
  }

  async function bevestigen() {
    if (!voorstel || !voorstel.type) return
    setOpslaanBezig(true)
    try {
      const et = EVENT_TYPES.find(t => t.type === voorstel.type)
      const uur = voorstel.start_uur ?? et?.start_hour ?? 9
      const startTimeISO = new Date(`${voorstel.start_datum || vandaagStr()}T${String(uur).padStart(2, '0')}:00:00`).toISOString()
      await onSave({
        type: voorstel.type,
        start_time: startTimeISO,
        start_hour: voorstel.start_uur ?? et?.start_hour ?? null,
        end_hour: voorstel.eind_uur ?? et?.end_hour ?? null,
        recovery_impact: et?.recovery_impact ?? 1,
        stress_load: et?.stress_load ?? 1,
        sleep_disruption: et?.sleep_disruption ?? 1,
        recurrence: (voorstel.recurrence as LifeEvent['recurrence']) || null,
        recurrence_days: voorstel.recurrence_dagen || null,
        end_date: voorstel.eind_datum || null,
        notes: voorstel.notitie || null,
        available_time_minutes: voorstel.beschikbare_tijd_minuten ?? null,
        priority: (voorstel.prioriteit as LifeEvent['priority']) ?? null,
      } as Partial<LifeEvent>)
      setVoorstel(null)
      setTekst('')
    } catch {
      /* onSave toont zelf al een foutmelding op de hoofdpagina */
    } finally {
      setOpslaanBezig(false)
    }
  }

  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">💬 Vertel de Coach</p>
      <div className="flex gap-2">
        <input value={tekst} onChange={e => setTekst(e.target.value)} onKeyDown={e => e.key === 'Enter' && verstuur()}
          placeholder="Bijv. 'Elke woensdag fysiotherapie'"
          className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
        <button onClick={verstuur} disabled={bezig || !tekst.trim()}
          className="px-4 bg-primary-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {bezig ? '...' : '→'}
        </button>
      </div>

      {voorstel && voorstel.gelukt && (
        <div className="mt-3 p-3 bg-primary-500/10 border border-primary-500/30 rounded-xl">
          <p className="text-xs text-primary-400 uppercase tracking-wider mb-1">Ik heb dit begrepen</p>
          <p className="text-sm text-slate-200 mb-3">{voorstel.samenvatting}</p>
          <div className="flex gap-2">
            <button onClick={bevestigen} disabled={opslaanBezig}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {opslaanBezig ? 'Bezig...' : '✓ Opslaan'}
            </button>
            <button onClick={() => { setVoorstel(null); setTekst('') }}
              className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold">
              ✏️ Opnieuw
            </button>
          </div>
        </div>
      )}

      {voorstel && !voorstel.gelukt && (
        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-sm text-amber-400">{voorstel.reden_mislukt || 'Kon dit niet interpreteren.'}</p>
          <p className="text-xs text-slate-500 mt-1">Probeer het preciezer te omschrijven, of gebruik de "+"-knop hierboven.</p>
        </div>
      )}
    </Card>
  )
}

// ── Snel instellen ────────────────────────────────────────────────────
function SnelInstellenRij({ onSnelToevoegen }: { onSnelToevoegen: (type: string) => void }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Snel instellen</p>
      <div className="flex gap-2">
        <button onClick={() => onSnelToevoegen('vakantie')} className="flex-1 flex flex-col items-center gap-1 bg-slate-800 rounded-2xl py-3 active:bg-slate-700">
          <span className="text-2xl">🏖️</span>
          <span className="text-xs text-slate-300">Vakantie</span>
        </button>
        <button onClick={() => onSnelToevoegen('ziek')} className="flex-1 flex flex-col items-center gap-1 bg-slate-800 rounded-2xl py-3 active:bg-slate-700">
          <span className="text-2xl">🤒</span>
          <span className="text-xs text-slate-300">Ziek</span>
        </button>
        <Link href="/injuries" className="flex-1 flex flex-col items-center gap-1 bg-slate-800 rounded-2xl py-3 active:bg-slate-700">
          <span className="text-2xl">🩹</span>
          <span className="text-xs text-slate-300">Blessure</span>
        </Link>
      </div>
    </div>
  )
}

// ── Weekstrip — met leesbare labels i.p.v. alleen emoji's ───────────────
function WeekKalender({ events }: { events: LifeEvent[] }) {
  // v2.4.187: week-navigatie toegevoegd — kon voorheen niet vooruit/
  // terug bladeren, dus een uitzondering in een toekomstige week (of
  // een event verder terug) kon nooit gecontroleerd worden zonder te
  // wachten tot die week vanzelf "deze week" werd.
  const [weekOffset, setWeekOffset] = useState(0)
  const vandaag = new Date()
  const startWeekdag = (vandaag.getDay() + 6) % 7
  const maandag = new Date(vandaag); maandag.setDate(vandaag.getDate() - startWeekdag + weekOffset * 7)
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(maandag); d.setDate(maandag.getDate() + i); return d })
  const weekLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
  const jaar = maandag.getFullYear()
  const feestdagen = getNederlandseFeestdagen(jaar)

  function getEventsVoorDag(dag: Date) {
    const dagStr = dag.toISOString().split('T')[0]
    return events.filter(e => e.recurrence ? isHerhalendActiefOpDag(e, dag) : isEenmaligActiefVandaag(e, dagStr))
  }
  function getFeestdag(dag: Date) { return feestdagen.find(f => f.date === dag.toISOString().split('T')[0]) }
  function isVandaag(dag: Date) { return dag.toDateString() === vandaag.toDateString() }
  function isWeekend(dag: Date) { const dn = dag.getDay(); return dn === 0 || dn === 6 }

  const dagenMetEvents = week.map(dag => ({ dag, events: getEventsVoorDag(dag) }))
  const alleLabels = [...new Set(dagenMetEvents.flatMap(d => d.events.map(e => EVENT_TYPES.find(t => t.type === e.type)?.label).filter(Boolean)))]

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setWeekOffset(o => o - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 active:bg-slate-700">
          <ChevronLeft size={14} />
        </button>
        <p className="text-xs text-slate-500 uppercase tracking-wider">
          {weekOffset === 0 ? 'Deze week' : `Week van ${maandag.getDate()} ${maandag.toLocaleDateString('nl-NL', { month: 'short' })}`}
        </p>
        <button onClick={() => setWeekOffset(o => o + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 active:bg-slate-700">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-3">
        {dagenMetEvents.map(({ dag, events: dagEvents }, i) => {
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

      {alleLabels.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-3 border-t border-coach-border">
          {alleLabels.map(label => {
            const et = EVENT_TYPES.find(e => e.label === label)
            return <span key={label} className="text-xs text-slate-400">{et?.icon} {label}</span>
          })}
        </div>
      )}
    </Card>
  )
}

// ── Invloed-stap — vriendelijke taal, veilige defaults, aanpasbaar ─────
function InvloedStap({ recoveryImpact, stressLoad, sleepDisruption, onChange }: {
  recoveryImpact: number; stressLoad: number; sleepDisruption: number
  onChange: (veld: 'recovery_impact' | 'stress_load' | 'sleep_disruption', waarde: number) => void
}) {
  const rijen: [string, string, number, 'recovery_impact' | 'stress_load' | 'sleep_disruption'][] = [
    ['Herstel-impact', 'Hoeveel vraagt dit van je herstel?', recoveryImpact, 'recovery_impact'],
    ['Stress', 'Hoeveel extra stress geeft dit?', stressLoad, 'stress_load'],
    ['Slaapverstoring', 'Hoeveel verstoort dit je slaap?', sleepDisruption, 'sleep_disruption'],
  ]
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">Vooraf ingevuld op basis van het type — pas gerust aan als jouw situatie anders is.</p>
      {rijen.map(([label, sub, waarde, veld]) => (
        <div key={veld}>
          <p className="text-sm text-white font-medium">{label}</p>
          <p className="text-xs text-slate-500 mb-2">{sub}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {IMPACT_NIVEAUS.map((niveauLabel, niveau) => (
              <button key={niveau} onClick={() => onChange(veld, niveau)}
                className={cn('py-2 rounded-lg text-xs font-medium', waarde === niveau ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                {niveauLabel}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Nieuw event sheet ──────────────────────────────────────────────
type Sheet = 'categorie' | 'type' | 'periode' | 'herhaling' | 'invloed'

function NieuwEventSheet({ onClose, onSave, startType }: {
  onClose: () => void
  onSave: (event: Partial<LifeEvent>) => Promise<void>
  startType?: string
}) {
  const voorgeselecteerdType = startType ? EVENT_TYPES.find(t => t.type === startType) : null
  const voorgeselecteerdeCategorie = voorgeselecteerdType ? EVENT_CATEGORIES.find(c => c.events.some(e => e.type === startType)) : null

  const [sheet, setSheet] = useState<Sheet>(voorgeselecteerdType ? 'periode' : 'categorie')
  const [gekozenCategorie, setGekozenCategorie] = useState<typeof EVENT_CATEGORIES[0] | null>(voorgeselecteerdeCategorie || null)
  const [gekozenType, setGekozenType] = useState<typeof EVENT_TYPES[0] | null>(voorgeselecteerdType || null)
  const [startDate, setStartDate] = useState(vandaagStr())
  const [endDate, setEndDate] = useState('')
  const [startHour, setStartHour] = useState<number | null>(voorgeselecteerdType?.start_hour ?? null)
  const [endHour, setEndHour] = useState<number | null>(voorgeselecteerdType?.end_hour ?? null)
  const [recurrence, setRecurrence] = useState('')
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  // v2.4.186-FIX: hoorde hier al bij v2.4.185, per ongeluk alleen in
  // het bewerkscherm gebouwd, niet hier in het toevoegscherm
  const [exceptions, setExceptions] = useState<string[]>([])
  const [nieuweException, setNieuweException] = useState('')
  const [recoveryImpact, setRecoveryImpact] = useState(voorgeselecteerdType?.recovery_impact ?? 1)
  const [stressLoad, setStressLoad] = useState(voorgeselecteerdType?.stress_load ?? 1)
  const [sleepDisruption, setSleepDisruption] = useState(voorgeselecteerdType?.sleep_disruption ?? 1)
  const [notes, setNotes] = useState('')
  // v2.4.185 (Coach Agenda Fase A) — puur additief, beïnvloedt de
  // Recovery Score niet
  const [availableTimeMinutes, setAvailableTimeMinutes] = useState<number | ''>('')
  const [priority, setPriority] = useState<'' | 'laag' | 'normaal' | 'hoog'>('')
  const [saving, setSaving] = useState(false)

  function kiesCategorie(cat: typeof EVENT_CATEGORIES[0]) { setGekozenCategorie(cat); setSheet('type') }
  function kiesType(et: typeof EVENT_TYPES[0]) {
    setGekozenType(et)
    setStartHour(et.start_hour); setEndHour(et.end_hour)
    setRecoveryImpact(et.recovery_impact); setStressLoad(et.stress_load); setSleepDisruption(et.sleep_disruption)
    setSheet('periode')
  }
  function kiesHerhaling(value: string) {
    setRecurrence(value)
    if (value === 'workdays') setRecurrenceDays([1,2,3,4,5])
    else if (value === 'weekend') setRecurrenceDays([6,0])
    else if (value === '' || value === 'daily') setRecurrenceDays([])
  }
  function onInvloedChange(veld: 'recovery_impact' | 'stress_load' | 'sleep_disruption', waarde: number) {
    if (veld === 'recovery_impact') setRecoveryImpact(waarde)
    if (veld === 'stress_load') setStressLoad(waarde)
    if (veld === 'sleep_disruption') setSleepDisruption(waarde)
  }

  async function opslaan() {
    if (!gekozenType) return
    setSaving(true)
    try {
      const uur = startHour !== null ? startHour : 9
      const startTimeISO = new Date(`${startDate}T${String(uur).padStart(2,'0')}:00:00`).toISOString()
      await onSave({
        type: gekozenType.type,
        start_time: startTimeISO,
        recovery_impact: recoveryImpact,
        stress_load: stressLoad,
        sleep_disruption: sleepDisruption,
        start_hour: startHour,
        end_hour: endHour,
        recurrence: recurrence || null,
        recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
        recurrence_end_date: recurrenceEndDate || null,
        // v2.4.186-FIX
        recurrence_exceptions: exceptions.length > 0 ? exceptions : null,
        end_date: endDate || null,
        notes: notes || null,
        // v2.4.185 (Coach Agenda Fase A)
        available_time_minutes: availableTimeMinutes === '' ? null : availableTimeMinutes,
        priority: priority || null,
      })
    } catch (err) {
      console.error('Opslaan mislukt:', err)
    } finally {
      setSaving(false)
    }
  }

  const titels: Record<Sheet, string> = {
    categorie: 'Wat speelt er?',
    type: gekozenCategorie?.label || '',
    periode: gekozenType?.label || '',
    herhaling: 'Herhaling',
    invloed: 'Invloed op jouw herstel',
  }
  const vorigeStap: Record<Sheet, Sheet> = { categorie: 'categorie', type: 'categorie', periode: 'type', herhaling: 'periode', invloed: 'herhaling' }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-coach-darker rounded-t-3xl flex flex-col max-h-[88vh]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-coach-border">
          {sheet !== 'categorie' && !(sheet === 'periode' && voorgeselecteerdType) && (
            <button onClick={() => setSheet(vorigeStap[sheet])} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
              <ArrowLeft size={16} className="text-slate-400" />
            </button>
          )}
          <p className="text-white font-semibold flex-1">{titels[sheet]}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {sheet === 'categorie' && (
            <div className="grid grid-cols-2 gap-3">
              {EVENT_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => kiesCategorie(cat)} className="bg-slate-800 rounded-2xl p-5 flex flex-col items-center gap-2 active:bg-slate-700">
                  <span className="text-3xl">{cat.icon}</span>
                  <span className="text-white font-medium text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {sheet === 'type' && gekozenCategorie && (
            <div className="flex flex-col gap-2">
              {gekozenCategorie.events.map(et => (
                <button key={et.type} onClick={() => kiesType(et)} className="flex items-center gap-4 p-4 bg-slate-800 rounded-2xl active:bg-slate-700 text-left">
                  <span className="text-2xl w-8 text-center">{et.icon}</span>
                  <div className="flex-1">
                    <p className="text-white font-medium">{et.label}</p>
                    {et.start_hour !== null && <p className="text-xs text-slate-500">{formatUur(et.start_hour)} – {formatUur(et.end_hour)}</p>}
                  </div>
                  <ChevronRight size={16} className="text-slate-600" />
                </button>
              ))}
            </div>
          )}

          {sheet === 'periode' && gekozenType && (
            <div className="flex flex-col gap-5">
              {voorgeselecteerdType && (
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <span className="text-2xl">{gekozenType.icon}</span>
                  <p className="text-white font-medium">{gekozenType.label}</p>
                </div>
              )}

              {/* v2.4.173: periode (start + eind) i.p.v. alleen een startdatum
                  — end_date bestond al in het datamodel, maar had nog nooit
                  een invoerveld. Geldt nu voor ELK type, niet alleen vakantie. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Begindatum</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Einddatum</label>
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                    placeholder="Zelfde dag"
                    className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              {!endDate && <p className="text-[10px] text-slate-600">Geen einddatum ingevuld — dit event geldt dan alleen op de begindatum.</p>}

              {gekozenType.start_hour !== null && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Tijden</label>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={startHour ?? ''} onChange={e => setStartHour(Number(e.target.value))} className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                    </select>
                    <select value={endHour ?? ''} onChange={e => setEndHour(Number(e.target.value))} className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                    </select>
                  </div>
                </div>
              )}

              <button onClick={() => setSheet('herhaling')} className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl active:bg-slate-700">
                <div className="flex-1 text-left">
                  <p className="text-xs text-slate-400">Herhaling</p>
                  <p className="text-white text-sm mt-0.5">{recurrence ? RECURRENCE_LABELS[recurrence] || recurrence : 'Eenmalig'}</p>
                </div>
                <ChevronRight size={16} className="text-slate-600" />
              </button>

              <Button onClick={() => setSheet('invloed')} fullWidth>Volgende</Button>
            </div>
          )}

          {sheet === 'herhaling' && (
            <div className="flex flex-col gap-3">
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => kiesHerhaling(opt.value)}
                  className={cn('flex items-center gap-4 p-4 rounded-xl', recurrence === opt.value ? 'bg-primary-600/20 border border-primary-500/50' : 'bg-slate-800')}>
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium">{opt.label}</p>
                    {'sub' in opt && <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>}
                  </div>
                  {recurrence === opt.value && <Check size={18} className="text-primary-400" />}
                </button>
              ))}
              {(recurrence === 'weekly' || recurrence === 'biweekly') && (
                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-2">Op welke dag?</p>
                  <div className="flex gap-2">
                    {DAGEN.map(dag => (
                      <button key={dag.nummer} onClick={() => setRecurrenceDays([dag.nummer])}
                        className={cn('flex-1 py-2.5 rounded-xl text-xs font-medium', recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                        {dag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {recurrence === 'custom' && (
                <div className="mt-2">
                  <p className="text-xs text-slate-400 mb-2">Welke dagen?</p>
                  <div className="flex gap-2">
                    {DAGEN.map(dag => (
                      <button key={dag.nummer} onClick={() => setRecurrenceDays(recurrenceDays.includes(dag.nummer) ? recurrenceDays.filter(d => d !== dag.nummer) : [...recurrenceDays, dag.nummer])}
                        className={cn('flex-1 py-2.5 rounded-xl text-xs font-medium', recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                        {dag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* v2.4.186-FIX: hoorde hier al bij v2.4.185, per ongeluk
                  vergeten in het toevoegscherm — alleen in het
                  bewerkscherm gebouwd */}
              {recurrence !== '' && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-slate-400">Uitzonderingen (regel geldt dan die dag niet)</p>
                  <div className="flex gap-2">
                    <input type="date" value={nieuweException} onChange={e => setNieuweException(e.target.value)}
                      min={vandaagStr()} className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    <button onClick={() => { if (nieuweException && !exceptions.includes(nieuweException)) { setExceptions([...exceptions, nieuweException].sort()); setNieuweException('') } }}
                      className="px-4 bg-slate-800 text-primary-400 rounded-xl text-sm font-semibold">
                      + Toevoegen
                    </button>
                  </div>
                  {exceptions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {exceptions.map(datum => (
                        <button key={datum} onClick={() => setExceptions(exceptions.filter(d => d !== datum))}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300">
                          {formatDatumKort(datum)} <X size={12} className="text-slate-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button onClick={() => setSheet('periode')} fullWidth className="mt-2">Klaar</Button>
            </div>
          )}

          {sheet === 'invloed' && (
            <div className="flex flex-col gap-5">
              <InvloedStap recoveryImpact={recoveryImpact} stressLoad={stressLoad} sleepDisruption={sleepDisruption} onChange={onInvloedChange} />
              {/* v2.4.185 (Coach Agenda Fase A) — puur additieve context,
                  raakt de Recovery Score niet */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Beschikbare tijd</label>
                  <input type="number" min={0} step={15} value={availableTimeMinutes}
                    onChange={e => setAvailableTimeMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="min" className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Prioriteit</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}
                    className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
                    <option value="">Geen</option>
                    <option value="laag">Laag</option>
                    <option value="normaal">Normaal</option>
                    <option value="hoog">Hoog</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Notitie (optioneel)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra context"
                  className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <Button onClick={opslaan} loading={saving} fullWidth>Opslaan</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Event Detail (bewerkbaar) ──────────────────────────────────────
function EventDetail({ event, onClose, onVerwijder, onUpdate }: {
  event: LifeEvent; onClose: () => void
  onVerwijder: (id: string) => void; onUpdate: (id: string, updates: Partial<LifeEvent>) => void
}) {
  const et = EVENT_TYPES.find(e => e.type === event.type)
  const heeftTijden = et?.start_hour !== null

  const [startHour, setStartHour] = useState<number>(event.start_hour ?? 9)
  const [endHour, setEndHour] = useState<number>(event.end_hour ?? 17)
  const [startDate, setStartDate] = useState(new Date(event.start_time).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(event.end_date || '')
  const [recurrence, setRecurrence] = useState(event.recurrence || '')
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(event.recurrence_days || [])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(event.recurrence_end_date || '')
  const [recoveryImpact, setRecoveryImpact] = useState(event.recovery_impact)
  const [stressLoad, setStressLoad] = useState(event.stress_load)
  const [sleepDisruption, setSleepDisruption] = useState(event.sleep_disruption)
  const [notes, setNotes] = useState(event.notes || '')
  // v2.4.185 (Coach Agenda Fase A)
  const [availableTimeMinutes, setAvailableTimeMinutes] = useState<number | ''>(event.available_time_minutes ?? '')
  const [priority, setPriority] = useState<'' | 'laag' | 'normaal' | 'hoog'>(event.priority ?? '')
  const [exceptions, setExceptions] = useState<string[]>(event.recurrence_exceptions || [])
  const [nieuweException, setNieuweException] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showHerhaling, setShowHerhaling] = useState(false)
  const [showInvloed, setShowInvloed] = useState(false)

  function kiesHerhaling(value: string) {
    setRecurrence(value)
    if (value === 'workdays') setRecurrenceDays([1,2,3,4,5])
    else if (value === 'weekend') setRecurrenceDays([6,0])
    else if (value === '' || value === 'daily') setRecurrenceDays([])
  }
  function onInvloedChange(veld: 'recovery_impact' | 'stress_load' | 'sleep_disruption', waarde: number) {
    if (veld === 'recovery_impact') setRecoveryImpact(waarde)
    if (veld === 'stress_load') setStressLoad(waarde)
    if (veld === 'sleep_disruption') setSleepDisruption(waarde)
  }

  async function slaOp() {
    setSaving(true)
    try {
      const startTimeISO = new Date(`${startDate}T${String(startHour).padStart(2,'0')}:00:00`).toISOString()
      const updates: Partial<LifeEvent> = {
        start_time: startTimeISO,
        start_hour: heeftTijden ? startHour : event.start_hour,
        end_hour: heeftTijden ? endHour : event.end_hour,
        end_date: endDate || null,
        recurrence: recurrence || null,
        recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
        recurrence_end_date: recurrenceEndDate || null,
        recovery_impact: recoveryImpact,
        stress_load: stressLoad,
        sleep_disruption: sleepDisruption,
        notes: notes || null,
        // v2.4.185 (Coach Agenda Fase A)
        available_time_minutes: availableTimeMinutes === '' ? null : availableTimeMinutes,
        priority: priority || null,
        recurrence_exceptions: exceptions.length > 0 ? exceptions : null,
      }
      const res = await fetch('/api/life-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.id, ...updates }),
      })
      const data = await res.json()
      if (data.success) {
        onUpdate(event.id, updates)
        setMessage('Opgeslagen')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch { setMessage('Mislukt') } finally { setSaving(false) }
  }

  if (showHerhaling) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHerhaling(false)} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h2 className="text-lg font-bold text-white">Herhaling</h2>
        </div>
        <div className="flex flex-col gap-3">
          {RECURRENCE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => kiesHerhaling(opt.value)}
              className={cn('flex items-center gap-4 p-4 rounded-xl', recurrence === opt.value ? 'bg-primary-600/20 border border-primary-500/50' : 'bg-slate-800')}>
              <div className="flex-1 text-left">
                <p className="text-white font-medium">{opt.label}</p>
                {'sub' in opt && <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>}
              </div>
              {recurrence === opt.value && <Check size={18} className="text-primary-400" />}
            </button>
          ))}
          {(recurrence === 'weekly' || recurrence === 'biweekly') && (
            <div className="mt-2">
              <p className="text-xs text-slate-400 mb-2">Op welke dag?</p>
              <div className="flex gap-2">
                {DAGEN.map(dag => (
                  <button key={dag.nummer} onClick={() => setRecurrenceDays([dag.nummer])}
                    className={cn('flex-1 py-2.5 rounded-xl text-xs font-medium', recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                    {dag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recurrence === 'custom' && (
            <div className="mt-2">
              <p className="text-xs text-slate-400 mb-2">Welke dagen?</p>
              <div className="flex gap-2">
                {DAGEN.map(dag => (
                  <button key={dag.nummer} onClick={() => setRecurrenceDays(recurrenceDays.includes(dag.nummer) ? recurrenceDays.filter(d => d !== dag.nummer) : [...recurrenceDays, dag.nummer])}
                    className={cn('flex-1 py-2.5 rounded-xl text-xs font-medium', recurrenceDays.includes(dag.nummer) ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400')}>
                    {dag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recurrence !== '' && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-slate-400">Einddatum (optioneel)</p>
              <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)}
                min={vandaagStr()} className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              {recurrenceEndDate && <button onClick={() => setRecurrenceEndDate('')} className="text-xs text-slate-500">Geen einddatum</button>}
            </div>
          )}
          {/* v2.4.185 (Coach Agenda Fase A): uitzonderingen — bijv.
              "iedere maandag dagdienst, BEHALVE 17 augustus" zonder de
              regel zelf te hoeven aanpassen of stoppen */}
          {recurrence !== '' && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-slate-400">Uitzonderingen (regel geldt dan die dag niet)</p>
              <div className="flex gap-2">
                <input type="date" value={nieuweException} onChange={e => setNieuweException(e.target.value)}
                  min={vandaagStr()} className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                <button onClick={() => { if (nieuweException && !exceptions.includes(nieuweException)) { setExceptions([...exceptions, nieuweException].sort()); setNieuweException('') } }}
                  className="px-4 bg-slate-800 text-primary-400 rounded-xl text-sm font-semibold">
                  + Toevoegen
                </button>
              </div>
              {exceptions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {exceptions.map(datum => (
                    <button key={datum} onClick={() => setExceptions(exceptions.filter(d => d !== datum))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-full text-xs text-slate-300">
                      {formatDatumKort(datum)} <X size={12} className="text-slate-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button onClick={() => setShowHerhaling(false)} fullWidth className="mt-2">Klaar</Button>
        </div>
      </div>
    )
  }

  if (showInvloed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowInvloed(false)} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h2 className="text-lg font-bold text-white">Invloed op jouw herstel</h2>
        </div>
        <InvloedStap recoveryImpact={recoveryImpact} stressLoad={stressLoad} sleepDisruption={sleepDisruption} onChange={onInvloedChange} />
        {/* v2.4.185 (Coach Agenda Fase A) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 uppercase tracking-wider">Beschikbare tijd</label>
            <input type="number" min={0} step={15} value={availableTimeMinutes}
              onChange={e => setAvailableTimeMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="min" className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 uppercase tracking-wider">Prioriteit</label>
            <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}
              className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
              <option value="">Geen</option>
              <option value="laag">Laag</option>
              <option value="normaal">Normaal</option>
              <option value="hoog">Hoog</option>
            </select>
          </div>
        </div>
        <Button onClick={() => setShowInvloed(false)} fullWidth className="mt-2">Klaar</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{et?.icon}</span> {et?.label || event.type}
          </h2>
        </div>
        <button onClick={() => onVerwijder(event.id)} className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Trash2 size={18} className="text-red-400" />
        </button>
      </div>

      {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-2"><p className="text-primary-400 text-sm">{message}</p></div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400 uppercase tracking-wider">Begindatum</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400 uppercase tracking-wider">Einddatum</label>
          <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} placeholder="Zelfde dag"
            className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      {heeftTijden && (
        <div className="grid grid-cols-2 gap-3">
          <select value={startHour} onChange={e => setStartHour(Number(e.target.value))} className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
          </select>
          <select value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none">
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
          </select>
        </div>
      )}

      <button onClick={() => setShowHerhaling(true)} className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl active:bg-slate-700">
        <div className="flex-1 text-left">
          <p className="text-xs text-slate-400">Herhaling</p>
          <p className="text-white text-sm mt-0.5">{recurrence ? RECURRENCE_LABELS[recurrence] || recurrence : 'Eenmalig'}</p>
        </div>
        <ChevronRight size={16} className="text-slate-600" />
      </button>

      <button onClick={() => setShowInvloed(true)} className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl active:bg-slate-700">
        <div className="flex-1 text-left">
          <p className="text-xs text-slate-400">Invloed op herstel</p>
          <div className="flex gap-2 mt-1">
            <ImpactBadge label="Herstel" value={recoveryImpact} />
            <ImpactBadge label="Stress" value={stressLoad} />
            <ImpactBadge label="Slaap" value={sleepDisruption} />
          </div>
        </div>
        <ChevronRight size={16} className="text-slate-600" />
      </button>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400 uppercase tracking-wider">Notitie</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra context (optioneel)"
          className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <Button onClick={slaOp} loading={saving} fullWidth>Opslaan</Button>
    </div>
  )
}

// ── Hoofdpagina ───────────────────────────────────────────────────
export default function LifeEventsPage() {
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [context, setContext] = useState<ResolvedContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [snelType, setSnelType] = useState<string | undefined>(undefined)
  const [message, setMessage] = useState('')
  const [geselecteerde, setGeselecteerde] = useState<LifeEvent | null>(null)

  const feestdagen = getNederlandseFeestdagen(new Date().getFullYear())
  const vandaagFeestdag = feestdagen.find(f => f.date === vandaagStr())

  useEffect(() => { laadAlles() }, [])

  async function laadAlles() {
    setLoading(true)
    try {
      const [eventsRes, contextRes] = await Promise.all([
        fetch('/api/life-events').then(r => r.json()),
        fetch('/api/life-events/context').then(r => r.json()),
      ])
      setEvents(eventsRes.events || [])
      if (contextRes.context) setContext(contextRes.context)
    } catch { setEvents([]) } finally { setLoading(false) }
  }

  async function slaEventOp(eventData: Partial<LifeEvent>) {
    try {
      const res = await fetch('/api/life-events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventData),
      })
      const data = await res.json()
      if (data.event) {
        setEvents(prev => [data.event, ...prev])
        setShowSheet(false); setSnelType(undefined)
        setMessage('Toegevoegd')
        setTimeout(() => setMessage(''), 2000)
        laadAlles() // context opnieuw ophalen — kan nu anders zijn
      } else { throw new Error(data.error || 'Opslaan mislukt') }
    } catch (err) {
      setMessage('Mislukt: ' + String(err))
      setTimeout(() => setMessage(''), 4000)
      throw err
    }
  }

  async function verwijder(id: string) {
    await fetch('/api/life-events?id=' + id, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
    setGeselecteerde(null)
    laadAlles()
  }

  function updateEvent(id: string, updates: Partial<LifeEvent>) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    if (geselecteerde?.id === id) setGeselecteerde(prev => prev ? { ...prev, ...updates } : null)
    laadAlles()
  }

  // ── Groepering: Nu actief / Binnenkort / Terugkerend ────────────────
  const { nuActief, binnenkort, terugkerend } = useMemo(() => {
    const vandaag = vandaagStr()
    const eenmalig = events.filter(e => !e.recurrence)
    const herhalend = events.filter(e => e.recurrence)
    return {
      nuActief: eenmalig.filter(e => isEenmaligActiefVandaag(e, vandaag)),
      binnenkort: eenmalig.filter(e => e.start_time.split('T')[0] > vandaag).sort((a, b) => a.start_time.localeCompare(b.start_time)),
      // Terugkerend: één regel per event, niet geëxplodeerd per dag
      terugkerend: herhalend,
    }
  }, [events])

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
          <Link href={'/settings'} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white flex-1">Levensgebeurtenissen</h1>
          <button onClick={() => setShowSheet(true)} className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center active:bg-primary-700">
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {message && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3">
            <p className="text-primary-400 text-sm">{message}</p>
          </div>
        )}

        {vandaagFeestdag && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-yellow-400">{vandaagFeestdag.icon} Vandaag is het {vandaagFeestdag.name}</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">De coach houdt hier automatisch rekening mee</p>
          </div>
        )}

        {/* Statuskaart — venster naar de Context Resolver */}
        {!loading && <ContextStatusKaart context={context} />}
        {loading && <div className="h-32 bg-coach-card rounded-2xl animate-pulse" />}

        {/* v2.4.188 (Coach Agenda Fase B): AI-invoer — verplichte
            bevestiging, slaat nooit rechtstreeks op */}
        <AiInvoerKaart onSave={slaEventOp} />

        <SnelInstellenRij onSnelToevoegen={(type) => { setSnelType(type); setShowSheet(true) }} />

        {!loading && <WeekKalender events={events} />}

        {/* Nu actief */}
        {nuActief.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Nu actief</p>
            <div className="flex flex-col gap-2">
              {nuActief.map(event => <EventRij key={event.id} event={event} onClick={() => setGeselecteerde(event)} />)}
            </div>
          </div>
        )}

        {/* Binnenkort */}
        {binnenkort.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Binnenkort</p>
            <div className="flex flex-col gap-2">
              {binnenkort.map(event => <EventRij key={event.id} event={event} onClick={() => setGeselecteerde(event)} />)}
            </div>
          </div>
        )}

        {/* Terugkerend — één regel per event, niet geëxplodeerd */}
        {terugkerend.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Terugkerend</p>
            <div className="flex flex-col gap-2">
              {terugkerend.map(event => {
                const gepauzeerd = context?.lifeContext.suppressedEvents.some(s => s.type === event.type)
                return <EventRij key={event.id} event={event} onClick={() => setGeselecteerde(event)} gepauzeerd={gepauzeerd} />
              })}
            </div>
          </div>
        )}

        {!loading && events.length === 0 && (
          <Card className="p-6 text-center">
            <Calendar size={32} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Geen events geregistreerd</p>
            <button onClick={() => setShowSheet(true)} className="mt-3 text-xs text-primary-400">+ Voeg toe</button>
          </Card>
        )}
      </div>

      {showSheet && (
        <NieuwEventSheet onClose={() => { setShowSheet(false); setSnelType(undefined) }} onSave={slaEventOp} startType={snelType} />
      )}
    </AppShell>
  )
}

function EventRij({ event, onClick, gepauzeerd }: { event: LifeEvent; onClick: () => void; gepauzeerd?: boolean }) {
  const et = EVENT_TYPES.find(e => e.type === event.type)
  const PRIORITY_KLEUR: Record<string, string> = { hoog: 'text-red-400 bg-red-500/10', normaal: 'text-slate-400 bg-slate-500/10', laag: 'text-slate-500 bg-slate-500/5' }
  return (
    <button onClick={onClick} className="w-full text-left">
      <Card className={cn('p-4 active:bg-slate-700', gepauzeerd && 'opacity-60')}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{et?.icon || '📅'}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-medium">{et?.label || event.type}</p>
              {/* v2.4.185: 🔄 prominenter bij terugkerende regels, zoals gevraagd */}
              {event.recurrence && <span className="text-xs text-primary-400">🔄 {formatHerhaling(event)}</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {event.recurrence ? '' : formatDatum(event.start_time)}
              {event.end_date && !event.recurrence && ` → ${formatDatumKort(event.end_date)}`}
              {event.start_hour !== null && event.end_hour !== null && ` · ${formatUur(event.start_hour)}–${formatUur(event.end_hour)}`}
              {/* v2.4.185 (Coach Agenda Fase A) */}
              {event.available_time_minutes ? ` · ${event.available_time_minutes} min beschikbaar` : ''}
            </p>
            {gepauzeerd && <p className="text-xs text-amber-400 mt-1">⏸ Tijdelijk gepauzeerd</p>}
            <div className="flex gap-2 mt-1.5 flex-wrap">
              <ImpactBadge label="Herstel" value={event.recovery_impact} />
              <ImpactBadge label="Stress" value={event.stress_load} />
              <ImpactBadge label="Slaap" value={event.sleep_disruption} />
              {event.priority && event.priority !== 'normaal' && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_KLEUR[event.priority]}`}>Prioriteit: {event.priority}</span>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-600 flex-shrink-0" />
        </div>
      </Card>
    </button>
  )
}
