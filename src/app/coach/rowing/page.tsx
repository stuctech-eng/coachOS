'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, Waves, Settings } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Rowing Coach — Fase 1, stap 1 (basisstructuur) ───────────────────────
// Bron: Rowing Platform Master Vision, vastgelegd 1 augustus 2026.
// Device Adapter Layer-architectuur: deze pagina praat NOOIT
// rechtstreeks met hardware. Vandaag (Fase 1, PWA): leest wat via
// bestaande paden binnenkomt (handmatige invoer/Strava/TCX). Concept2-
// OAuth-koppeling volgt als aparte stap, zodra developer-sleutels
// beschikbaar zijn. Live BLE naar de PM5 (Fase 2) is technisch niet
// haalbaar binnen een iOS-PWA (Safari heeft geen Web Bluetooth) — blijft
// bewust een apart, toekomstig Native-traject.
//
// Bewuste keuze deze stap: eerlijke lege staat i.p.v. een dashboard dat
// doet alsof er al een Rowing Engine bestaat — die komt in een latere
// stap (Training Plan Engine, Workout Builder, Analyse-engine).

interface RowingActiviteit {
  id: string
  date: string
  duration: number
  metrics: Record<string, number> | null
  source: string
}

// v2.4.222: extra vangnet op weergaveniveau — de structurele fix
// (hieronder, bij de sync-routes zelf) voorkomt dubbele records al bij
// het importeren, maar deze functie blijft als extra zekerheid staan
// (bijv. voor records die al vóór deze fix zijn geïmporteerd).
const BRON_PRIORITEIT: Record<string, number> = { concept2: 3, garmin: 2, strava: 1, apple_health: 1, manual: 0 }

function dedupliceerOpDatum(activiteiten: RowingActiviteit[]): RowingActiviteit[] {
  const perDatum = new Map<string, RowingActiviteit>()
  for (const a of activiteiten) {
    const bestaande = perDatum.get(a.date)
    const huidigePrioriteit = BRON_PRIORITEIT[a.source] ?? 0
    const bestaandePrioriteit = bestaande ? (BRON_PRIORITEIT[bestaande.source] ?? 0) : -1
    if (!bestaande || huidigePrioriteit > bestaandePrioriteit) {
      perDatum.set(a.date, a)
    }
  }
  return Array.from(perDatum.values())
}

// v2.4.233 (Rowing Fase 2 — dashboard-verrijking): week-/maandstatistieken,
// berekend uit de al-opgehaalde 90-dagen-activiteiten (haalRowingData) —
// geen nieuwe route/databron. Recovery/Readiness/Coach Score blijven
// bewust bij /performance (platformbreed, geen dubbele berekening hier).
interface RowingStatistieken {
  weekSessies: number; weekMinuten: number; weekAfstand: number
  maandSessies: number; maandMinuten: number; maandAfstand: number
}

function berekenStatistieken(activiteiten: RowingActiviteit[]): RowingStatistieken {
  const nu = new Date()
  const weekGeleden = new Date(nu.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const maandGeleden = new Date(nu.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const opWeek = activiteiten.filter(a => a.date >= weekGeleden)
  const opMaand = activiteiten.filter(a => a.date >= maandGeleden)

  const som = (lijst: RowingActiviteit[], veld: 'duration' | 'afstand') =>
    lijst.reduce((totaal, a) => totaal + (veld === 'duration' ? a.duration : (a.metrics?.distance || 0)), 0)

  return {
    weekSessies: opWeek.length, weekMinuten: som(opWeek, 'duration'), weekAfstand: som(opWeek, 'afstand'),
    maandSessies: opMaand.length, maandMinuten: som(opMaand, 'duration'), maandAfstand: som(opMaand, 'afstand'),
  }
}

export default function RowingPage() {
  const [laden, setLaden] = useState(true)
  const [activiteiten, setActiviteiten] = useState<RowingActiviteit[]>([])
  const [fout, setFout] = useState<string | null>(null)
  // v2.4.218: Concept2-koppelingsstatus
  const [concept2Verbonden, setConcept2Verbonden] = useState<boolean | null>(null)
  const [urlMelding, setUrlMelding] = useState<string | null>(null)
  const [syncBezig, setSyncBezig] = useState(false)

  useEffect(() => {
    fetch('/api/specialists/rowing/data')
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setActiviteiten(d.activiteiten || []) })
      .catch(() => setFout('Kon Rowing-data niet ophalen'))
      .finally(() => setLaden(false))

    fetch('/api/specialists/rowing/concept2/status')
      .then(r => r.json())
      .then(d => setConcept2Verbonden(!!d.verbonden))
      .catch(() => setConcept2Verbonden(false))

    // Melding tonen na terugkomst van de OAuth-flow
    const params = new URLSearchParams(window.location.search)
    if (params.get('concept2_verbonden')) {
      // v2.4.300-FIX: onderscheid maken — een geslaagde koppeling waar
      // Concept2's eigen user-id niet opgehaald kon worden (bijv. omdat
      // Concept2's API op dat moment zelf een probleem had) is geen
      // "succesvol gekoppeld" zonder kanttekening. Sync werkt nog
      // steeds, maar de webhook zou deze gebruiker niet herkennen.
      if (params.get('concept2_user_id_ontbreekt')) {
        setUrlMelding('Concept2 gekoppeld — "Sync nu" werkt, maar Concept2 gaf geen gebruikers-id terug (mogelijk een probleem bij Concept2 zelf op dit moment). De automatische webhook zal hierdoor niet werken. Probeer het opnieuw te koppelen zodra Concept2 weer stabiel is — controleer daarna via /debug/concept2-webhook of het veld gevuld is.')
      } else {
        setUrlMelding('Concept2 succesvol gekoppeld!')
      }
      setConcept2Verbonden(true)
      window.history.replaceState({}, '', '/coach/rowing')
    } else if (params.get('concept2_error')) {
      setUrlMelding('Koppelen mislukt: ' + params.get('concept2_error'))
      window.history.replaceState({}, '', '/coach/rowing')
    }
  }, [])

  // v2.4.219 (data-sync): haalt nieuwe resultaten op bij Concept2,
  // herlaadt daarna de sessielijst zodat nieuwe data direct zichtbaar is
  async function syncConcept2() {
    setSyncBezig(true)
    setUrlMelding(null)
    try {
      const res = await fetch('/api/specialists/rowing/concept2/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setUrlMelding('Sync mislukt: ' + (data.error || 'onbekende fout'))
      } else {
        // v2.4.220-FIX: "0/0" was ambigu — kon betekenen "Concept2 gaf
        // niets terug" OF "wel gevonden, maar opslaan mislukte". Nu
        // altijd totaalGevonden erbij, en de eerste opslag-fout indien
        // van toepassing — zichtbaar i.p.v. verborgen in server-logs.
        let melding = `Sync voltooid — ${data.geimporteerd} nieuwe sessie(s), ${data.overgeslagen} al bekend (${data.totaalGevonden} gevonden bij Concept2)`
        if (data.eersteInsertFout) melding += `. Fout bij opslaan: ${data.eersteInsertFout}`
        setUrlMelding(melding)
        const dataRes = await fetch('/api/specialists/rowing/data')
        const nieuweData = await dataRes.json()
        if (!nieuweData.error) setActiviteiten(nieuweData.activiteiten || [])
      }
    } catch {
      setUrlMelding('Sync mislukt: verbindingsfout')
    } finally {
      setSyncBezig(false)
    }
  }

  const heeftData = activiteiten.length > 0

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/specialisten" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Rowing Coach</h1>
            <p className="text-xs text-slate-500">Trainingsbelasting &amp; sessies</p>
          </div>
          <Link href="/settings/rowing-profile" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <Settings size={18} className="text-slate-400" />
          </Link>
        </div>

        {/* v2.4.233: dashboard-verrijking — week-/maandbelasting, puur
            afgeleid uit de al-opgehaalde data. Recovery/Readiness/Coach
            Score bewust NIET hier herberekend — dat is platformbreed,
            zie /performance (link onderaan deze kaart). */}
        {!laden && heeftData && (() => {
          const stats = berekenStatistieken(activiteiten)
          return (
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Trainingsbelasting</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Deze week</p>
                  <p className="text-2xl font-bold text-white">{stats.weekSessies}</p>
                  <p className="text-xs text-slate-400">sessie{stats.weekSessies === 1 ? '' : 's'}</p>
                  <p className="text-xs text-slate-500 mt-1">{stats.weekMinuten} min{stats.weekAfstand > 0 ? ` · ${(stats.weekAfstand / 1000).toFixed(1)} km` : ''}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Deze maand</p>
                  <p className="text-2xl font-bold text-white">{stats.maandSessies}</p>
                  <p className="text-xs text-slate-400">sessie{stats.maandSessies === 1 ? '' : 's'}</p>
                  <p className="text-xs text-slate-500 mt-1">{stats.maandMinuten} min{stats.maandAfstand > 0 ? ` · ${(stats.maandAfstand / 1000).toFixed(1)} km` : ''}</p>
                </div>
              </div>
              <Link href="/performance" className="text-xs text-primary-400 mt-4 inline-block">
                Herstel &amp; Coach Score bekijken →
              </Link>
              {/* v2.4.239: link naar de nieuwe, experimentele Universal
                  Athlete Platform-weergave */}
              <Link href="/athlete-platform" className="text-xs text-slate-500 mt-2 block">
                🧬 Jouw digitale model (experimenteel) →
              </Link>
            </Card>
          )
        })()}

        {/* v2.4.223 (Fase 1, stap 3): link naar het nieuwe trainingsplan */}
        <Link href="/coach/rowing/trainingsplan">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Trainingsplan</p>
              <p className="text-xs text-slate-400 mt-0.5">Periodisering, sessies per week</p>
            </div>
            <span className="text-slate-500">→</span>
          </Card>
        </Link>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {urlMelding && (
          <Card className={`p-3 text-sm ${(urlMelding.includes('mislukt') || urlMelding.includes('Fout bij')) ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
            {urlMelding}
          </Card>
        )}

        {/* v2.4.218: Concept2-koppelingskaart — enige plek die de OAuth-
            flow triggert, altijd zichtbaar zodra de status bekend is */}
        {concept2Verbonden !== null && (
          <Card className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Concept2 Logbook</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {concept2Verbonden ? '✓ Gekoppeld' : 'Nog niet gekoppeld'}
              </p>
            </div>
            {!concept2Verbonden ? (
              <a href="/api/specialists/rowing/concept2/authorize"
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold active:bg-primary-700">
                Verbind
              </a>
            ) : (
              // v2.4.301-FIX: gemeld — er was geen enkele manier om
              // opnieuw te koppelen zodra concept2Verbonden true was;
              // de "Verbind"-link verdween volledig, alleen "Sync nu"
              // bleef over. Zonder herverbind-optie kon een leeg
              // concept2_user_id (v2.4.286-probleem) nooit meer
              // gerepareerd worden via de UI — de gebruiker kreeg de
              // instructie "verbreek en herverbind" terwijl dat
              // helemaal niet mogelijk was. Callback doet toch al een
              // upsert (onConflict: user_id), dus opnieuw autoriseren
              // terwijl je al gekoppeld bent is veilig — geen
              // voorafgaande disconnect-stap nodig.
              <div className="flex gap-2">
                <button onClick={syncConcept2} disabled={syncBezig}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold active:bg-slate-700 disabled:opacity-50">
                  {syncBezig ? 'Bezig...' : 'Sync nu'}
                </button>
                <a href="/api/specialists/rowing/concept2/authorize"
                  className="px-3 py-2 bg-white/5 text-slate-400 rounded-xl text-xs font-medium active:bg-white/10 flex items-center">
                  Opnieuw koppelen
                </a>
              </div>
            )}
          </Card>
        )}

        {!laden && fout && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400">{fout}</p>
          </Card>
        )}

        {!laden && !fout && !heeftData && (
          <Card className="p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
              <Waves size={28} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-semibold">Nog geen roeidata</p>
              <p className="text-sm text-slate-400 mt-1">
                Rowing Coach is net gestart. Zodra je een roeisessie logt
                (handmatig, via Strava, of via Concept2, hierboven te
                koppelen), verschijnt hier je dashboard.
              </p>
            </div>
            <div className="w-full pt-3 mt-1 border-t border-coach-border flex flex-col gap-2 text-left">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Binnenkort</p>
              <p className="text-sm text-slate-400">📊 Analyse na elke sessie</p>
            </div>
          </Card>
        )}

        {!laden && !fout && heeftData && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Recente sessies</p>
            <div className="flex flex-col gap-2">
              {dedupliceerOpDatum(activiteiten).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-coach-border last:border-0">
                  <div>
                    <p className="text-sm text-white">{new Date(a.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-xs text-slate-500">{a.source}</p>
                  </div>
                  {/* v2.4.217-FIX: duration staat al in MINUTEN
                      (zie strava-activity-processor.ts: moving_time/60
                      bij opslag) — de extra /60 hier rondde elke
                      normale sessie af naar 0 min */}
                  <p className="text-sm text-slate-300">{a.duration} min</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-4">
              Records en grafieken volgen in een volgende stap.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
