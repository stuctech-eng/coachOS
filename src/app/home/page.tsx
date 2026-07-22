'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Sparkles, Bell, Calendar, RefreshCw, MessageCircle, AlertTriangle, Camera, BookOpen, Phone, ShieldAlert, CircleUserRound, HeartPulse } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCoach } from '@/hooks/useCoach'
import { useCoachStore } from '@/store'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { getGreeting, formatDate } from '@/utils'
import { cn } from '@/utils'
import { createBrowserClient } from '@supabase/ssr'

interface WeerData {
  stad: string
  temp: number
  omschrijving: string
  emoji: string
  wind: number
  dagdelen: {
    ochtend: { label: string }
    middag: { label: string }
    avond: { label: string }
  }
  // v2.4.168: TIJDELIJK, voor de GPS-fix-verificatie
  _debug_locatie?: { bron: 'gps' | 'ip' | 'fallback'; lat: number; lon: number }
}

const VERSIE_STORAGE_KEY = 'coachos_laatst_geziene_versie'

// v2.4.14: lichte gezondheidscheck — alleen Laag 1 (kerntabellen) + Laag 2
// (kernroutes), GEEN schrijftest (die hoort thuis in /debug, niet
// ongevraagd op de achtergrond op Home). Dit is bewust een subset van de
// volledige check in debug/page.tsx: snel, puur lezend, alleen bedoeld om
// een net-gedeployde-en-mogelijk-kapotte update snel te signaleren.
const KERN_TABELLEN_LICHT = ['profiles', 'coach_calls', 'coach_call_items', 'training_results', 'coach_recommendations'] as const
const KERN_ROUTES_LICHT = ['/api/status', '/api/coach', '/api/coach-calls'] as const

async function draaiLichteGezondheidscheck(supabase: ReturnType<typeof createBrowserClient>): Promise<number> {
  let problemen = 0
  for (const tabel of KERN_TABELLEN_LICHT) {
    try {
      const { error } = await supabase.from(tabel).select('id').limit(1)
      if (error) problemen++
    } catch {
      problemen++
    }
  }
  for (const route of KERN_ROUTES_LICHT) {
    try {
      const res = await fetch(route, { method: 'GET', credentials: 'include' })
      if (!res.ok && res.status !== 304) problemen++
    } catch {
      problemen++
    }
  }
  return problemen
}

function getScoreLabel(score: number | null): string {
  if (!score) return '—'
  if (score >= 90) return 'Elite Readiness'
  if (score >= 75) return 'Klaar'
  if (score >= 60) return 'Voorzichtig'
  if (score >= 40) return 'Herstel nodig'
  return 'Hoog Risico'
}

function getScoreKleur(score: number | null): string {
  if (!score) return 'text-slate-400'
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreBg(score: number | null): string {
  if (!score) return 'bg-slate-800'
  if (score >= 75) return 'bg-green-500/10 border border-green-500/20'
  if (score >= 50) return 'bg-orange-500/10 border border-orange-500/20'
  return 'bg-red-500/10 border border-red-500/20'
}

function getRisicoKleur(): string {
  return 'bg-orange-500/10 border-orange-500/30 text-orange-400'
}

export default function HomePage() {
  const { profile } = useAuth()
  const { recommendation, checkin, isGenerating, generateAdvice, hasCheckin } = useCoach()
  const { coachStatus, setCoachStatus, actionPlan, actionPlanDatum, setActionPlan } = useCoachStore()
  const router = useRouter()

  const [showReasoning, setShowReasoning] = useState(false)
  const [berekenend, setBerekenend] = useState(false)
  const [laden, setLaden] = useState(true)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [garminImported, setGarminImported] = useState(true)
  const [garminDatum, setGarminDatum] = useState<string | null>(null)
  const [coachCall, setCoachCall] = useState<{ id: string; pending_count: number; coach_call_items: { id: string }[] } | null>(null)
  const [weer, setWeer] = useState<WeerData | null>(null)
  // v2.4.14: automatische update-detectie + lichte gezondheidscheck
  const [updateProbleem, setUpdateProbleem] = useState<{ nieuweVersie: string; problemen: number } | null>(null)

  const greeting = getGreeting(profile?.display_name || profile?.first_name)
  const score = coachStatus?.coach_score ?? null
  const vandaag = new Date().toISOString().split('T')[0]
  const heeftRisicos = coachStatus?.risk_flags && coachStatus.risk_flags.length > 0

  // Weerbericht ophalen — v2.4.168-FIX: GPS eerst, IP-locatie alleen als
  // vangnet (was andersom, gaf verkeerde locatie tijdens reizen — zie
  // overleg 22 juli 2026)
  useEffect(() => {
    function haalWeerOp(lat?: number, lon?: number) {
      const url = lat !== undefined && lon !== undefined ? `/api/weather?lat=${lat}&lon=${lon}` : '/api/weather'
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && !data.error) {
            setWeer(data)
            if (data._debug_locatie) console.log('[weer] locatiebron:', data._debug_locatie)
          }
        })
        .catch(() => {})
    }

    function vraagGpsEnHaalWeerOp() {
      if (!navigator.geolocation) { haalWeerOp(); return }
      navigator.geolocation.getCurrentPosition(
        pos => {
          console.log('[weer] GPS ontvangen:', pos.coords.latitude, pos.coords.longitude)
          haalWeerOp(pos.coords.latitude, pos.coords.longitude)
        },
        () => haalWeerOp(), // permissie geweigerd of mislukt — val terug op IP-locatie
        { timeout: 5000, maximumAge: 10 * 60 * 1000 } // maximaal 10 min oude GPS-fix hergebruiken
      )
    }

    vraagGpsEnHaalWeerOp()

    // Opnieuw ophalen zodra de app weer op de voorgrond komt — belangrijk
    // als je onderweg bent en van locatie verandert
    function onZichtbaarheidWijziging() {
      if (document.visibilityState === 'visible') vraagGpsEnHaalWeerOp()
    }
    document.addEventListener('visibilitychange', onZichtbaarheidWijziging)
    return () => document.removeEventListener('visibilitychange', onZichtbaarheidWijziging)
  }, [])

  // v2.4.169: Today Engine — de enige bron voor "wat moet ik vandaag
  // doen", kiest zelf tussen Specialist-trainingsplan en Trainer AI
  const [todayPlan, setTodayPlan] = useState<{
    source: string; title: string; duration: number | null; intensity: string | null
    reason: string; coachMessage: string; actionHref: string; actionLabel: string
  } | null>(null)
  useEffect(() => {
    fetch('/api/today', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.plan) setTodayPlan(data.plan) })
      .catch(() => {})
  }, [])

  // v2.4.14: versie-check — bij een nieuw versienummer t.o.v. de vorige
  // sessie draait een lichte gezondheidscheck op de achtergrond. Bij
  // problemen verschijnt een banner die naar /debug verwijst voor de
  // volledige diagnose (inclusief Laag 3 schrijftest). Faalt de check zelf
  // stil (netwerk, etc.) → geen banner, geen verstoring van de gebruiker.
  useEffect(() => {
    const checkVersie = async () => {
      try {
        const res = await fetch('/api/version')
        if (!res.ok) return
        const data = await res.json()
        const nieuweVersie = data?.version
        if (!nieuweVersie) return

        const laatstGezien = window.localStorage.getItem(VERSIE_STORAGE_KEY)
        if (laatstGezien === nieuweVersie) return // geen update sinds vorige keer

        // Nieuwe versie gedetecteerd (of eerste bezoek — laatstGezien is null)
        if (laatstGezien !== null) {
          const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
          )
          const problemen = await draaiLichteGezondheidscheck(supabase)
          if (problemen > 0) {
            setUpdateProbleem({ nieuweVersie, problemen })
          }
        }
        window.localStorage.setItem(VERSIE_STORAGE_KEY, nieuweVersie)
      } catch { /* stil falen — geen storende banner bij een netwerkhikje */ }
    }
    checkVersie()
  }, [])

  // Check Garmin import vandaag
  useEffect(() => {
    const checkGarmin = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        )
        const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
        const gisterenAms = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
        const { data: vandaagData } = await supabase
          .from('garmin_imports')
          .select('id, date')
          .eq('status', 'confirmed')
          .gte('date', gisterenAms)
          .order('date', { ascending: false })
          .limit(1)
          .single()
        const isVandaag = vandaagData?.date === vandaagAms
        setGarminImported(isVandaag)
        setGarminDatum(vandaagData?.date ?? null)
      } catch {
        setGarminImported(true)
        setGarminDatum(null)
      }
    }
    checkGarmin()
  }, [])

  const herberekenIndienCompleet = useCallback(() => {
    const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    if (garminDatum !== vandaagAms || !hasCheckin) return
    if (typeof window === 'undefined') return
    const scoreDatum = window.localStorage.getItem('coach_status_datum')
    if (scoreDatum === vandaagAms) return

    fetch('/api/status', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.coach_score !== undefined) {
          const statusData = {
            coach_score: data.coach_score ?? null,
            recovery_score: data.recovery_score ?? null,
            training_score: data.training_score ?? null,
            lifestyle_score: data.lifestyle_score ?? null,
            risk_flags: data.risk_flags || [],
            status_color: data.status_color || 'orange',
            date: vandaagAms,
          }
          window.localStorage.setItem('coach_status_datum', vandaagAms)
          window.localStorage.setItem('coach_status_data', JSON.stringify(statusData))
          setCoachStatus(statusData)
        }
      })
      .catch(() => {})
  }, [garminDatum, hasCheckin, setCoachStatus])

  useEffect(() => { herberekenIndienCompleet() }, [herberekenIndienCompleet])

  useEffect(() => {
    fetch('/api/coach-calls', { method: 'POST', credentials: 'include' })
      .then(() => fetch('/api/coach-calls', { credentials: 'include' }))
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCoachCall(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (coachStatus && coachStatus.date === vandaag) {
      setLaden(false)
      return
    }
    if (typeof window !== 'undefined') {
      try {
        const opgeslaanDatum = window.localStorage.getItem('coach_status_datum')
        const opgeslaanStatus = window.localStorage.getItem('coach_status_data')
        if (opgeslaanDatum === vandaag && opgeslaanStatus) {
          const parsed = JSON.parse(opgeslaanStatus)
          setCoachStatus(parsed)
          setLaden(false)
          return
        }
      } catch { /* */ }
    }
    setLaden(false)
    setBerekenend(true)
    fetch('/api/status', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setCoachStatus(data)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('coach_status_data', JSON.stringify(data))
          window.localStorage.setItem('coach_status_datum', vandaag)
        }
      })
      .catch(() => {})
      .finally(() => setBerekenend(false))
  }, [])

  useEffect(() => {
    if (actionPlan && actionPlanDatum === vandaag) return
    if (typeof window !== 'undefined') {
      try {
        const opgeslaanDatum = window.localStorage.getItem('dagplan_datum')
        const opgeslaanPlan = window.localStorage.getItem('dagplan_data')
        if (opgeslaanDatum === vandaag && opgeslaanPlan) {
          const parsed = JSON.parse(opgeslaanPlan)
          setActionPlan(parsed, vandaag)
        }
      } catch { /* */ }
    }
  }, [])

  const berekenCoachScore = async () => {
    setBerekenend(true)
    try {
      const res = await fetch('/api/status', { method: 'POST' })
      const data = await res.json()
      setCoachStatus(data)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('coach_status_data', JSON.stringify(data))
        window.localStorage.setItem('coach_status_datum', vandaag)
      }
    } catch { /* */ }
    finally { setBerekenend(false) }
  }

  const genereerDagplan = async () => {
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/action-plan', { method: 'POST' })
      const data = await res.json()
      if (data.plan) {
        setActionPlan(data.plan, vandaag)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('dagplan_data', JSON.stringify(data.plan))
          window.localStorage.setItem('dagplan_datum', vandaag)
        }
      }
    } catch { /* */ }
    finally { setGeneratingPlan(false) }
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm capitalize">{formatDate(new Date())}</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{greeting}</h1>
            {weer && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                <p className="text-xs text-slate-400">
                  {weer.emoji} {weer.stad} · {weer.temp}°C · {weer.omschrijving}
                </p>
                <p className="text-xs text-slate-500">
                  Ochtend {weer.dagdelen.ochtend.label} · Middag {weer.dagdelen.middag.label} · Avond {weer.dagdelen.avond.label}
                </p>
                {weer._debug_locatie && (
                  <p className="text-[10px] text-amber-500/70">
                    🔧 debug: bron={weer._debug_locatie.bron}, lat={weer._debug_locatie.lat.toFixed(4)}, lon={weer._debug_locatie.lon.toFixed(4)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="w-11 h-11 rounded-xl bg-coach-card flex items-center justify-center text-slate-400">
              <Bell size={20} />
            </button>
            {/* v2.4.93: account-icoon — Navigatie-architectuur v1.0, Stap 5.
                Instellingen staat niet meer in de onderste navigatiebalk
                (5-tabs-structuur), dit is nu de ingang. */}
            <Link href={'/settings'} className="w-11 h-11 rounded-xl bg-coach-card flex items-center justify-center text-slate-400">
              <CircleUserRound size={20} />
            </Link>
          </div>
        </div>

        {/* v2.4.14: Update-probleem banner — alleen zichtbaar na een
            gedetecteerde versiewissel MET gevonden problemen */}
        {updateProbleem && (
          <Link href={'/debug'} className="w-full text-left active:opacity-70">
            <Card className="px-5 py-4 border border-red-500/30 bg-red-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert size={18} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Update gedetecteerd (v{updateProbleem.nieuweVersie})</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {updateProbleem.problemen} {updateProbleem.problemen === 1 ? 'probleem' : 'problemen'} gevonden — tik voor volledige diagnose
                  </p>
                </div>
                <ChevronDown size={16} className="text-red-400/50 -rotate-90 flex-shrink-0" />
              </div>
            </Card>
          </Link>
        )}

        {/* Coach Call */}
        {coachCall && coachCall.pending_count > 0 && (
          <Link href={'/coach-call'} className="w-full text-left active:opacity-70">
            <Card className="px-5 py-4 border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Coach Call</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {coachCall.pending_count} activiteit{coachCall.pending_count !== 1 ? 'en' : ''} wacht{coachCall.pending_count === 1 ? '' : 'en'} op evaluatie
                  </p>
                </div>
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {coachCall.pending_count}
                </span>
              </div>
            </Card>
          </Link>
        )}

        {/* Check-in */}
        {!hasCheckin ? (
          <Link href="/checkin">
            <Card className="px-5 py-4 border border-primary-500/30 bg-primary-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">Ochtend check-in</p>
                  <p className="text-slate-400 text-xs mt-0.5">Hoe voel je je vandaag?</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
                  <ChevronDown size={16} className="-rotate-90" />
                </div>
              </div>
            </Card>
          </Link>
        ) : checkin && (
          <p className="text-xs text-slate-500 px-1">
            ✓ Check-in voltooid — gevoel {checkin.feeling_score}, energie {checkin.energy_score}
            {(checkin as {stress_score?: number}).stress_score ? `, stress ${(checkin as {stress_score?: number}).stress_score}` : ''}
          </p>
        )}

        {/* Garmin reminder */}
        {!garminImported && (
          <Link href={'/settings/garmin-import'}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-left active:bg-blue-500/15 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Camera size={16} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-400">Garmin data importeren</p>
              <p className="text-xs text-slate-500 mt-0.5">Vandaag nog geen screenshot geüpload</p>
            </div>
            <ChevronDown size={16} className="text-blue-400/50 -rotate-90 flex-shrink-0" />
          </Link>
        )}

        {/* v2.4.142: Performance — platformniveau, geen Cycling/Running-
            specifieke plek. Altijd zichtbaar, niet afhankelijk van
            garminImported — de pagina zelf toont een nette lege staat. */}
        <Link href={'/performance'}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-left active:bg-rose-500/15 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
            <HeartPulse size={16} className="text-rose-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-400">Performance</p>
            <p className="text-xs text-slate-500 mt-0.5">Herstel &amp; belastbaarheid</p>
          </div>
          <ChevronDown size={16} className="text-rose-400/50 -rotate-90 flex-shrink-0" />
        </Link>

        {/* Coach Score */}
        <Card className={cn('p-5', getScoreBg(score))}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Coach Score</p>
                {(() => {
                  const vandaagStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  const gisterenStr = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  const garminVandaag = garminDatum === vandaagStr
                  const garminGisteren = garminDatum === gisterenStr
                  if (garminVandaag && hasCheckin) return <div className="w-2 h-2 rounded-full bg-green-400" />
                  if (garminVandaag || garminGisteren || hasCheckin) return <div className="w-2 h-2 rounded-full bg-amber-400" />
                  return <div className="w-2 h-2 rounded-full bg-slate-500" />
                })()}
              </div>
              <div className="flex items-end gap-2">
                {laden || berekenend ? (
                  <div className="h-12 w-20 bg-slate-700 rounded-xl animate-pulse" />
                ) : (
                  <>
                    <p className={cn('text-5xl font-bold leading-none', getScoreKleur(score))}>{score ?? '—'}</p>
                    <p className="text-slate-500 text-sm mb-1">/100</p>
                  </>
                )}
              </div>
              {!laden && !berekenend && score && (
                <p className={cn('text-sm font-semibold mt-1', getScoreKleur(score))}>{getScoreLabel(score)}</p>
              )}
            </div>
            <button onClick={berekenCoachScore} disabled={berekenend}
              className="w-9 h-9 rounded-xl bg-slate-800/50 flex items-center justify-center active:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={16} className={cn('text-slate-400', berekenend && 'animate-spin')} />
            </button>
          </div>
          {coachStatus && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Herstel', score: coachStatus.recovery_score },
                { label: 'Training', score: coachStatus.training_score },
                { label: 'Leefstijl', score: coachStatus.lifestyle_score },
              ].map(({ label, score: s }) => (
                <div key={label} className="bg-slate-800/60 rounded-xl p-2 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={cn('text-lg font-bold', getScoreKleur(s))}>{s ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Risico's */}
        {heeftRisicos && (
          <div className={cn('rounded-xl px-4 py-3 border flex items-start gap-3', getRisicoKleur())}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold mb-1">Aandachtspunten</p>
              {coachStatus!.risk_flags.map((flag, i) => (
                <p key={i} className="text-xs opacity-80">• {flag}</p>
              ))}
            </div>
          </div>
        )}

        {/* Dagboek */}
        <Link href="/dagboek">
          <Card className="px-5 py-4 border border-slate-700/50 active:bg-slate-800/80 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <BookOpen size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Dagboek</p>
                  <p className="text-slate-400 text-xs mt-0.5">Hoe was je dag?</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-slate-500 -rotate-90" />
            </div>
          </Card>
        </Link>

        {/* Vandaag van je Coach */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-primary-400">
              <Sparkles size={18} />
              <span className="text-sm font-medium">Vandaag van je Coach</span>
            </div>
            <button onClick={() => { generateAdvice(); genereerDagplan() }} disabled={isGenerating || generatingPlan}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={14} className={cn('text-slate-400', (isGenerating || generatingPlan) && 'animate-spin')} />
            </button>
          </div>

          {recommendation ? (
            <>
              <p className="text-base font-semibold text-white leading-snug mb-3">{recommendation.recommendation}</p>
              {(() => {
                const bullets: string[] = (() => {
                  try {
                    const ab = (recommendation as {advice_bullets?: string | string[]}).advice_bullets
                    if (Array.isArray(ab)) return ab
                    if (typeof ab === 'string') return JSON.parse(ab)
                    return []
                  } catch { return [] }
                })()
                return bullets.length > 0 ? (
                  <ul className="mb-3 flex flex-col gap-1">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-primary-400 mt-0.5 flex-shrink-0">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null
              })()}
              {(() => {
                const actie = (recommendation as {actie_type?: string}).actie_type || 'herstel'
                // v2.4.169: Today Engine — de enige bron voor "wat moet
                // ik vandaag doen". Toont zichtbaar welke bron leidend
                // is (specialist-trainingsplan of Trainer AI) i.p.v.
                // dit stilzwijgend alleen in de routing te verwerken.
                return todayPlan && todayPlan.source !== 'rust' && actie === 'trainen' ? (
                  <div className="bg-slate-800/50 rounded-xl p-3 mb-3 flex items-center gap-3">
                    <span className="text-xl">{todayPlan.source === 'cycling' ? '🚴' : todayPlan.source === 'running' ? '🏃' : '💪'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{todayPlan.title}</p>
                      <p className="text-xs text-slate-400">
                        {todayPlan.duration ? `${todayPlan.duration} min` : ''}{todayPlan.duration && todayPlan.intensity ? ' · ' : ''}{todayPlan.intensity ? `intensiteit: ${todayPlan.intensity}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 flex-shrink-0">
                      {todayPlan.source === 'cycling' ? 'Cycling Coach' : todayPlan.source === 'running' ? 'Running Coach' : 'Trainer AI'}
                    </span>
                  </div>
                ) : null
              })()}
              {(() => {
                const actie = (recommendation as {actie_type?: string}).actie_type || 'herstel'
                // v2.4.169: bij "trainen" gebruikt de knop nu de Today
                // Engine-uitkomst (specialist-trainingsplan of Trainer AI,
                // wat vandaag leidend is) i.p.v. altijd blind naar
                // /training te sturen — voorkomt dat je naar Trainer AI
                // gestuurd wordt terwijl er een Cycling/Running-sessie
                // gepland stond.
                const config = actie === 'trainen' && todayPlan && todayPlan.source !== 'rust'
                  ? { label: todayPlan.actionLabel, kleur: 'bg-green-500 active:bg-green-600', route: todayPlan.actionHref }
                  : {
                      trainen: { label: 'Start Training', kleur: 'bg-green-500 active:bg-green-600', route: '/training' },
                      herstel: { label: 'Start Herstel', kleur: 'bg-blue-500 active:bg-blue-600', route: '/training' },
                      rust: { label: 'Rust vandaag', kleur: 'bg-slate-600 active:bg-slate-700', route: null },
                    }[actie] || { label: 'Start', kleur: 'bg-primary-500', route: '/training' }
                // v2.4.21 FIX: wis de opgeslagen scrollpositie voor /training
                // (uit v2.4.20's AppShell scroll-herstel) vlak vóór een verse
                // navigatie vanuit Home. Zo blijft dit pad ongewijzigd
                // (Training opent bovenaan, zoals bewust gewenst), terwijl
                // terugkeer vanuit Archief via router.back() wél de
                // scrollpositie herstelt — die cache wordt daar niet gewist.
                const handleStartClick = () => {
                  if (config.route) {
                    try { sessionStorage.removeItem('coachos_scroll_' + config.route) } catch { /* */ }
                    router.push(config.route)
                  }
                }
                return config.route ? (
                  <button onClick={handleStartClick}
                    className={`w-full py-3 rounded-xl text-sm font-semibold text-white mb-3 ${config.kleur}`}>
                    {config.label}
                  </button>
                ) : (
                  <div className="w-full py-3 rounded-xl text-sm font-semibold text-slate-400 bg-slate-800 text-center mb-3">
                    {config.label} ✓
                  </div>
                )
              })()}
              <button onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-2 text-sm text-primary-400 mb-4">
                {showReasoning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Waarom?
              </button>
              {showReasoning && recommendation.reasoning && (
                <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                  <p className="text-slate-300 text-sm leading-relaxed">{recommendation.reasoning}</p>
                </div>
              )}
            </>
          ) : !hasCheckin ? (
            <p className="text-slate-400 text-sm mb-4">Doe eerst je check-in voor persoonlijk advies.</p>
          ) : (
            <div className="mb-4">
              <Button onClick={generateAdvice} loading={isGenerating} fullWidth>
                {isGenerating ? 'Coach denkt na...' : 'Genereer advies'}
              </Button>
            </div>
          )}

          {/* Dagplan */}
          <div className="border-t border-coach-border pt-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Dagplan</p>
            {generatingPlan ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />)}
              </div>
            ) : actionPlan && actionPlan.length > 0 ? (
              <div className="flex flex-col gap-2">
                {actionPlan.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-slate-800/50 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-primary-400 font-mono font-semibold flex-shrink-0 mt-0.5 w-10">{item.tijd}</span>
                    <p className="text-sm text-slate-200 leading-snug">{item.actie}</p>
                  </div>
                ))}
              </div>
            ) : (
              <button onClick={genereerDagplan} disabled={generatingPlan}
                className="w-full py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm active:bg-slate-700 disabled:opacity-50">
                {generatingPlan ? 'Bezig...' : 'Maak dagplan'}
              </button>
            )}
          </div>
        </Card>

        {/* Snelle links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/chat">
            <Card className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <MessageCircle size={16} className="text-primary-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Coach Chat</p>
                  <p className="text-slate-500 text-xs">Stel een vraag</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/weekly">
            <Card className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <Calendar size={16} className="text-primary-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Week</p>
                  <p className="text-slate-500 text-xs">Overzicht</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

      </div>
    </AppShell>
  )
}
