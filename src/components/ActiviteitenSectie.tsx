'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus, RefreshCw, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

// ── ActiviteitenSectie ──────────────────────────────────────────────────
// v2.4.93: geëxtraheerd uit de voormalige losse /activities-pagina
// (Navigatie-architectuur v1.0) — herbruikt nu zowel in de nog-bestaande
// /activities-route (backwards compatible voor eventuele diepe links) als
// in de nieuwe Voortgang-pagina, als eerste sectie. Geen logica
// gedupliceerd, alleen verplaatst.

interface ActivityMetrics {
  distance?: number
  avg_hr?: number
  max_hr?: number
  elevation?: number
  elevation_gain?: number
  elevation_loss?: number
  avg_speed?: number
  max_speed?: number
  calories?: number
  avg_cadence?: number
  max_cadence?: number
  avg_watts?: number
  max_watts?: number
}

interface ActivitySession {
  id: string
  date: string
  duration: number
  metrics: ActivityMetrics
  source: string
  notes: string | null
  activities: { name: string } | null
  tss: number | null
  intensiteit: 'laag' | 'gemiddeld' | 'hoog' | null
  bronLink: string | null
}

const SPORT_ICONS: Record<string, string> = {
  Hardlopen: '🏃',
  Fietsen: '🚴',
  Wandelen: '🚶',
  Zwemmen: '🏊',
  Krachttraining: '🏋️',
  Yoga: '🧘',
  Roeien: '🚣',
  Padel: '🎾',
  Tennis: '🎾',
  CrossFit: '💪',
  Kettlebell: '🔔',
}

// v2.4.305: expliciete bronlabel-mapping — verving een bug
// (session.source === 'strava' ? 'Strava' : 'Garmin'), waardoor
// Concept2- én Trainer AI-activiteiten ten onrechte "Garmin" toonden.
// Alle vier bevestigde source-waarden (zie regressiecontrole,
// verificatiefase) expliciet benoemd, plus een neutrale fallback voor
// 'manual' (toegestaan door de constraint, nergens actief gebruikt) en
// eventuele toekomstige, nu-onbekende waarden.
const BRON_LABELS: Record<string, string> = {
  strava: 'Strava',
  garmin: 'Garmin',
  concept2: 'Concept2',
  trainer_ai: 'In-app',
  manual: 'Handmatig',
}
function bronLabel(source: string): string {
  return BRON_LABELS[source] || 'Onbekend'
}

const INTENSITEIT_KLEUR: Record<string, string> = {
  laag: 'bg-green-500',
  gemiddeld: 'bg-blue-500',
  hoog: 'bg-red-500',
}
const INTENSITEIT_LABEL: Record<string, string> = {
  laag: 'Laag',
  gemiddeld: 'Gemiddeld',
  hoog: 'Hoog',
}

function formatDuur(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function formatAfstand(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${m} m`
}

function formatDatum(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// v2.4.305: getStravaActivityId() verwijderd — enige gebruik was de
// oude, per-activiteit Strava-link, nu vervangen door het algemene
// dashboard (session.bronLink) — geen dode code laten staan.

// compact = true: geen eigen paginatitel/header, bedoeld om als sectie
// binnen een andere pagina (Voortgang) te worden getoond
export function ActiviteitenSectie({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [weekdoelMinuten, setWeekdoelMinuten] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('alle')
  const [periode, setPeriode] = useState<'week' | 'maand'>('week')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; importedNames?: string[] } | null>(null)
  const [langzameSync, setLangzameSync] = useState(false)

  async function handleStravaSync() {
    setSyncing(true)
    setSyncResult(null)
    setLangzameSync(false)
    const langzameSyncTimer = setTimeout(() => setLangzameSync(true), 10000)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setSyncResult({
        success: data.success !== false,
        message: data.message || (data.success === false ? (data.error || 'Sync mislukt') : 'Sync klaar'),
        importedNames: data.importedNames,
      })
      if (data.success !== false) await laadActiviteiten()
    } catch (e) {
      setSyncResult({ success: false, message: 'Sync mislukt — netwerkfout: ' + (e as Error).message })
    } finally {
      setSyncing(false)
      setLangzameSync(false)
      clearTimeout(langzameSyncTimer)
    }
  }

  useEffect(() => {
    laadActiviteiten()
  }, [])

  async function laadActiviteiten() {
    setLoading(true)
    try {
      const res = await fetch('/api/activities')
      const data = await res.json()
      setSessions(data.sessions || [])
      setWeekdoelMinuten(data.weekdoelMinuten || 0)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const sporttypes = ['alle', ...Array.from(new Set(sessions.map(s => s.activities?.name || 'Anders')))]

  const gefilterd = filter === 'alle'
    ? sessions
    : sessions.filter(s => (s.activities?.name || 'Anders') === filter)

  // v2.4.305 (Activiteiten-scherm, Stap 3): Dashboard-berekening.
  // Bewust dezelfde definitie van "periode" als de bestaande, al-
  // werkende week-telling hierboven had (rollend, niet kalender-
  // gebaseerd) — geen nieuwe, afwijkende periode-definitie invoeren.
  // "Deze maand" = rollend 30 dagen, zelfde patroon.
  const periodeDagen = periode === 'week' ? 7 : 30
  const nu = new Date()
  const periodeStart = new Date(nu); periodeStart.setDate(periodeStart.getDate() - periodeDagen)
  const vorigePeriodeStart = new Date(nu); vorigePeriodeStart.setDate(vorigePeriodeStart.getDate() - periodeDagen * 2)

  const dashboardSessies = filter === 'alle' ? sessions : gefilterd
  const huidigePeriodeSessies = dashboardSessies.filter(s => new Date(s.date) >= periodeStart)
  const vorigePeriodeSessies = dashboardSessies.filter(s => new Date(s.date) >= vorigePeriodeStart && new Date(s.date) < periodeStart)

  function periodeTotalen(lijst: ActivitySession[]) {
    const duurMin = lijst.reduce((acc, s) => acc + s.duration, 0)
    // Alleen sessies MET afstand tellen mee — geen sessie zonder afstand
    // laten meetellen als 0 (zou de gemiddelde afstand-indruk vertekenen,
    // architectuurbesluit "nooit ontbrekende data als 0 meenemen")
    const afstandM = lijst.reduce((acc, s) => acc + (s.metrics.distance || 0), 0)
    const tssWaarden = lijst.map(s => s.tss).filter((t): t is number => t !== null)
    const gemTss = tssWaarden.length > 0 ? Math.round(tssWaarden.reduce((a, b) => a + b, 0) / tssWaarden.length) : null
    return { duurMin, afstandKm: afstandM / 1000, gemTss }
  }

  const huidig = periodeTotalen(huidigePeriodeSessies)
  const vorig = periodeTotalen(vorigePeriodeSessies)
  const trendPct = vorig.duurMin > 0 ? Math.round(((huidig.duurMin - vorig.duurMin) / vorig.duurMin) * 100) : null

  // Weekdoel-voortgang — alleen zinvol bij "week" (er bestaat geen
  // maanddoel-bron, niet zelf verzinnen door het weekdoel × 4 te doen)
  const weekdoelVoortgangPct = periode === 'week' && weekdoelMinuten > 0
    ? Math.min(100, Math.round((huidig.duurMin / weekdoelMinuten) * 100))
    : null

  return (
    <div className="text-white">
      {!compact && (
        <div className="px-4 pt-2 pb-4">
          <h1 className="text-2xl font-bold text-white">Activiteiten</h1>
        </div>
      )}

      {compact ? (
        // v2.4.305: compact-modus ONGEWIJZIGD gelaten — heeft op dit
        // moment geen consumers (bevestigd tijdens de verificatiefase),
        // maar de prop zelf blijft bestaan; geen regressie riskeren op
        // iets dat morgen weer in gebruik genomen kan worden.
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="bg-coach-card rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-1">Deze week</p>
            <p className="text-2xl font-bold text-white">{huidigePeriodeSessies.length}</p>
            <p className="text-xs text-gray-400">activiteiten</p>
          </div>
          <div className="bg-coach-card rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-1">Tijd</p>
            <p className="text-2xl font-bold text-white">{formatDuur(huidig.duurMin)}</p>
            {huidig.afstandKm > 0 && <p className="text-xs text-gray-400">{huidig.afstandKm.toFixed(1)} km</p>}
          </div>
        </div>
      ) : (
        // v2.4.305: Voortgang Dashboard — screenshot-referentie
        // (gebruiker, 8 augustus 2026). Alleen op de volledige pagina.
        <div className="px-4 mb-4">
          <div className="bg-coach-card border border-coach-border/40 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Voortgang Dashboard</p>
            </div>
            <div className="flex bg-[#0d1117] rounded-xl p-1 mb-4">
              <button onClick={() => setPeriode('week')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${periode === 'week' ? 'bg-white text-black' : 'text-gray-400'}`}>
                Deze week
              </button>
              <button onClick={() => setPeriode('maand')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${periode === 'maand' ? 'bg-white text-black' : 'text-gray-400'}`}>
                Deze maand
              </button>
            </div>

            <div className="flex justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Totaal tijd</p>
                <p className="text-xl font-bold text-white">{formatDuur(huidig.duurMin)}</p>
              </div>
              {huidig.afstandKm > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Totaal afstand</p>
                  <p className="text-xl font-bold text-white">{huidig.afstandKm.toFixed(1)} km</p>
                </div>
              )}
              {huidig.gemTss !== null && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Gem. Trainingsbelasting</p>
                  <p className="text-xl font-bold text-white">{huidig.gemTss}</p>
                </div>
              )}
            </div>

            {trendPct !== null && (
              <p className={`text-xs mb-3 ${trendPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {trendPct >= 0 ? '↗' : '↘'} {trendPct >= 0 ? '+' : ''}{trendPct}% (vs. vorige {periode === 'week' ? 'week' : 'maand'})
              </p>
            )}

            {weekdoelVoortgangPct !== null && (
              <>
                <div className="w-full h-2 bg-[#0d1117] rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${weekdoelVoortgangPct}%` }} />
                </div>
                <div className="flex justify-between">
                  <p className="text-[11px] text-gray-500">Weekdoel ({formatDuur(weekdoelMinuten)})</p>
                  <p className="text-[11px] text-gray-400">{weekdoelVoortgangPct}%</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className={compact ? 'mb-4' : 'px-4 mb-4'}>
        <Link href={'/settings/garmin-activity-import'}
          className="w-full bg-coach-card rounded-2xl p-4 flex items-center gap-3 active:bg-[#22272e] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Plus size={20} className="text-blue-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-white">Activiteit toevoegen</p>
            <p className="text-xs text-gray-400">Via Garmin screenshot of TCX-bestand</p>
          </div>
          <ChevronRight size={18} className="text-gray-600 flex-shrink-0" />
        </Link>

        <button onClick={handleStravaSync} disabled={syncing}
          className="w-full mt-2 bg-coach-card rounded-2xl p-4 flex items-center gap-3 active:bg-[#22272e] transition-colors disabled:opacity-60">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={18} className={`text-orange-400 ${syncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-white">{syncing ? 'Synchroniseren...' : 'Synchroniseer Strava'}</p>
            <p className="text-xs text-gray-400">Haal nieuwe Strava-activiteiten op</p>
          </div>
        </button>

        {syncing && langzameSync && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">Dit duurt langer dan gebruikelijk — Strava reageert traag. Nog even geduld (max. 20 sec).</p>
          </div>
        )}

        {syncResult && !syncing && (
          <div className={`mt-2 px-3 py-2 rounded-lg ${syncResult.success ? 'bg-primary-500/10 border border-primary-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <p className={`text-xs ${syncResult.success ? 'text-primary-400' : 'text-red-400'}`}>{syncResult.message}</p>
            {syncResult.importedNames && syncResult.importedNames.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {syncResult.importedNames.map((naam, i) => (
                  <p key={i} className="text-xs text-slate-400">• {naam}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {sporttypes.length > 1 && (
        <div className={compact ? 'mb-4 overflow-x-auto' : 'px-4 mb-4 overflow-x-auto'}>
          <div className="flex gap-2 w-max">
            {sporttypes.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-coach-card text-gray-400 hover:text-white'
                }`}
              >
                {type === 'alle' ? 'Alle' : `${SPORT_ICONS[type] || '🏅'} ${type}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* v2.4.332: link naar de al-bestaande Rowing Performance Center
          (records + progressie per testafstand, gebouwd v2.4.309-311)
          — gevraagd: "records en grafieken, voortgang/verbetering zien"
          bij Roeien. Niet opnieuw gebouwd, alleen vindbaar gemaakt. */}
      {filter === 'Roeien' && (
        <Link href="/coach/rowing/performance"
          className={`${compact ? 'mb-4' : 'mx-4 mb-4'} flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-2xl px-4 py-3`}>
          <div>
            <p className="text-sm font-semibold text-white">Records & voortgang bekijken</p>
            <p className="text-xs text-white/50 mt-0.5">Persoonlijke records en verbetering per testafstand</p>
          </div>
          <span className="text-orange-400 text-sm">→</span>
        </Link>
      )}

      <div className={compact ? 'space-y-3' : 'px-4 space-y-3 pb-6'}>
        {loading ? (
          Array.from({ length: compact ? 2 : 4 }).map((_, i) => (
            <div key={i} className="bg-coach-card rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2d333b]" />
                <div className="flex-1">
                  <div className="h-4 bg-[#2d333b] rounded w-24 mb-2" />
                  <div className="h-3 bg-[#2d333b] rounded w-16" />
                </div>
              </div>
            </div>
          ))
        ) : gefilterd.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏅</p>
            <p className="text-gray-400 text-sm">Geen activiteiten gevonden</p>
            <p className="text-gray-500 text-xs mt-1">Synchroniseer Strava of importeer een Garmin bestand</p>
          </div>
        ) : (
          (compact ? gefilterd.slice(0, 5) : gefilterd).map(session => {
            const naam = session.activities?.name || 'Anders'
            const icoon = SPORT_ICONS[naam] || '🏅'
            const { distance, avg_hr, calories, avg_speed, max_speed, avg_cadence, max_cadence, avg_watts, max_watts } = session.metrics
            const elevationGain = session.metrics.elevation ?? session.metrics.elevation_gain
            // v2.4.305: bronLink komt nu server-side kant-en-klaar mee
            // (Concept2 specifieke workout, Garmin/Strava algemeen
            // dashboard) — vervangt de oude, Strava-only getStravaActivityId-check.
            const externeLink = session.bronLink

            const kaartInhoud = (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2d333b] flex items-center justify-center text-xl flex-shrink-0">
                    {icoon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white text-sm">{naam}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        session.source === 'strava' ? 'bg-orange-900/40 text-orange-400' : 'bg-blue-900/40 text-blue-400'
                      }`}>
                        {bronLabel(session.source)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDatum(session.date)}</p>
                  </div>
                  {externeLink && <ChevronRight size={18} className="text-gray-600 flex-shrink-0" />}
                </div>

                <div className="mt-3 flex gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500">Duur</p>
                    <p className="text-sm font-medium text-white">{formatDuur(session.duration)}</p>
                  </div>
                  {distance && distance > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Afstand</p>
                      <p className="text-sm font-medium text-white">{formatAfstand(distance)}</p>
                    </div>
                  )}
                  {avg_hr && (
                    <div>
                      <p className="text-xs text-gray-500">Hartslag</p>
                      <p className="text-sm font-medium text-white">{avg_hr} bpm</p>
                    </div>
                  )}
                  {calories && (
                    <div>
                      <p className="text-xs text-gray-500">Calorieën</p>
                      <p className="text-sm font-medium text-white">{calories} kcal</p>
                    </div>
                  )}
                  {elevationGain && elevationGain > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Hoogte</p>
                      <p className="text-sm font-medium text-white">+{elevationGain}m</p>
                    </div>
                  )}
                  {avg_speed && avg_speed > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Snelheid</p>
                      <p className="text-sm font-medium text-white">{avg_speed} km/u</p>
                      {max_speed && <p className="text-xs text-gray-500">max {max_speed}</p>}
                    </div>
                  )}
                  {avg_cadence && avg_cadence > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Cadans</p>
                      <p className="text-sm font-medium text-white">{avg_cadence} spm</p>
                      {max_cadence && <p className="text-xs text-gray-500">max {max_cadence}</p>}
                    </div>
                  )}
                  {avg_watts && avg_watts > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Watts</p>
                      <p className="text-sm font-medium text-white">{avg_watts}W</p>
                      {max_watts && <p className="text-xs text-gray-500">max {max_watts}W</p>}
                    </div>
                  )}
                </div>

                {/* v2.4.305: Trainingsbelasting — alleen tonen als de
                    server 'm kon berekenen (Cycling/Running/Rowing met
                    profiel + de juiste metric). Wandelen en ontbrekende
                    data: geen regel, nooit een gegokt cijfer. */}
                {session.tss !== null && session.intensiteit !== null && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">Trainingsbelasting</p>
                      <p className="text-xs text-gray-400">{INTENSITEIT_LABEL[session.intensiteit]}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#2d333b] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${INTENSITEIT_KLEUR[session.intensiteit]}`}
                          style={{ width: `${Math.min(100, session.tss)}%` }} />
                      </div>
                      <p className="text-xs font-medium text-white flex-shrink-0">{session.tss}/100</p>
                    </div>
                  </div>
                )}
              </>
            )

            if (externeLink) {
              return (
                <a key={session.id} href={externeLink} target="_blank" rel="noopener noreferrer"
                  className="block bg-coach-card border border-coach-border/40 rounded-2xl p-5 active:bg-[#22272e] transition-colors">
                  {kaartInhoud}
                </a>
              )
            }

            return (
              <button key={session.id} onClick={() => router.push(`/activities/${session.id}`)}
                className="block w-full text-left bg-coach-card border border-coach-border/40 rounded-2xl p-5 active:bg-[#22272e] transition-colors">
                {kaartInhoud}
              </button>
            )
          })
        )}
        {compact && gefilterd.length > 5 && (
          <Link href={'/activities'} className="w-full text-center py-2 text-xs text-primary-400">
            Alle {gefilterd.length} activiteiten bekijken →
          </Link>
        )}
      </div>
    </div>
  )
}
