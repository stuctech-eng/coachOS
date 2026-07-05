'use client'
import { Suspense, useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LogOut, User, Target, Info, ChevronRight, Activity, RefreshCw, CheckCircle, XCircle, Zap, Calendar, Camera, BarChart2, HelpCircle, Wrench, Bug, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface StravaStatus {
  connected: boolean
  athlete_name: string | null
  last_sync: string | null
}

interface SyncResult {
  success: boolean
  message: string
  imported?: number
  skipped?: number
  importedNames?: string[]
  errors?: string[]
}

// v2.4.22: REBUILD van de sync-UI. Voorheen kon het resultaatbericht
// verdwijnen zonder duidelijke reden (bv. als de request nooit teruggaf
// door het ontbreken van een timeout aan de serverkant — zie
// strava/sync/route.ts). Nu: het resultaat blijft altijd zichtbaar tot de
// volgende sync-poging, en na 10 seconden zonder resultaat verschijnt een
// expliciete "dit duurt langer dan verwacht"-melding in plaats van alleen
// een spinner die eindeloos kan blijven draaien.
function StravaSection() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [stravaStatus, setStravaStatus] = useState<StravaStatus>({ connected: false, athlete_name: null, last_sync: null })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [langzameSync, setLangzameSync] = useState(false)
  const langzameSyncTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/strava/sync', { credentials: 'include' }).then(r => r.json()).then(setStravaStatus).catch(() => {})
    const stravaParam = searchParams.get('strava')
    if (stravaParam === 'connected') setSyncResult({ success: true, message: 'Strava gekoppeld!' })
    if (stravaParam === 'error') setSyncResult({ success: false, message: 'Koppeling mislukt. Probeer opnieuw.' })
  }, [searchParams])

  const handleStravaSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setLangzameSync(false)

    // Na 10 sec zonder resultaat: laat expliciet weten dat het langer duurt
    // dan gebruikelijk, in plaats van een spinner die niets zegt
    langzameSyncTimer.current = setTimeout(() => setLangzameSync(true), 10000)

    try {
      const res = await fetch('/api/strava/sync', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      setSyncResult({
        success: data.success !== false,
        message: data.message || (data.success === false ? (data.error || 'Sync mislukt') : 'Sync klaar'),
        imported: data.imported,
        skipped: data.skipped,
        importedNames: data.importedNames,
        errors: data.errors,
      })
      fetch('/api/strava/sync', { credentials: 'include' }).then(r => r.json()).then(setStravaStatus).catch(() => {})
    } catch (e) {
      setSyncResult({ success: false, message: 'Sync mislukt — netwerkfout: ' + (e as Error).message })
    } finally {
      setSyncing(false)
      setLangzameSync(false)
      if (langzameSyncTimer.current) clearTimeout(langzameSyncTimer.current)
    }
  }

  useEffect(() => {
    return () => { if (langzameSyncTimer.current) clearTimeout(langzameSyncTimer.current) }
  }, [])

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <Activity size={20} className="text-orange-400" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">Strava</p>
          <p className="text-slate-400 text-xs">
            {stravaStatus.connected ? stravaStatus.athlete_name || 'Gekoppeld' : 'Niet gekoppeld'}
          </p>
        </div>
        {stravaStatus.connected
          ? <CheckCircle size={18} className="text-coach-green" />
          : <XCircle size={18} className="text-slate-600" />
        }
      </div>

      {syncing && langzameSync && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400">Dit duurt langer dan gebruikelijk — Strava reageert traag. Nog even geduld (max. 20 sec).</p>
        </div>
      )}

      {syncResult && !syncing && (
        <div className={`mb-3 px-3 py-2 rounded-lg ${syncResult.success ? 'bg-primary-500/10 border border-primary-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          <p className={`text-xs ${syncResult.success ? 'text-primary-400' : 'text-red-400'}`}>{syncResult.message}</p>
          {syncResult.importedNames && syncResult.importedNames.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {syncResult.importedNames.map((naam, i) => (
                <p key={i} className="text-xs text-slate-400">• {naam}</p>
              ))}
            </div>
          )}
          {syncResult.errors && syncResult.errors.length > 0 && (
            <p className="text-xs text-red-400/70 mt-1">{syncResult.errors.length} activiteit(en) gaven een fout — check Debug diagnostiek voor details.</p>
          )}
        </div>
      )}

      {stravaStatus.connected ? (
        <div className="flex flex-col gap-2">
          <Button onClick={handleStravaSync} loading={syncing} variant="secondary" fullWidth size="sm">
            <RefreshCw size={14} className="mr-2" />
            Activiteiten synchroniseren
          </Button>
          <Button onClick={() => router.push('/activities')} variant="secondary" fullWidth size="sm">
            <BarChart2 size={14} className="mr-2" />
            Bekijk activiteiten
          </Button>
        </div>
      ) : (
        <Button onClick={() => window.location.href = '/api/strava/auth'} variant="secondary" fullWidth size="sm">
          Verbind Strava
        </Button>
      )}
    </Card>
  )
}

export default function SettingsPage() {
  const { profile, user, signOut } = useAuth()
  const router = useRouter()
  // v2.4.22: versienummer nu dynamisch uit /api/version, net als
  // hoe-werkt-het/page.tsx (v2.4.14) — was hier nog hardcoded "v1.8.5",
  // een derde losstaand versienummer naast package.json en de al-gefixte
  // hoe-werkt-het-pagina. Zie README sectie "Versienummer — één bron van
  // waarheid".
  const [versie, setVersie] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/version')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.version) setVersie(data.version) })
      .catch(() => {})
  }, [])

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-white">Instellingen</h1>

        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-500/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-400">{profile?.first_name?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold">{profile?.display_name || profile?.first_name || 'Gebruiker'}</p>
              <p className="text-slate-400 text-sm">{user?.email}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <button
            onClick={() => router.push('/settings/garmin-import')}
            className="flex items-center gap-3 w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Camera size={20} className="text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-semibold text-sm">Garmin Import</p>
              <p className="text-slate-400 text-xs">Screenshot uploaden voor dagdata</p>
            </div>
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        </Card>

        <Card className="p-4">
          <button
            onClick={() => router.push('/settings/garmin-activity-import')}
            className="flex items-center gap-3 w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Camera size={20} className="text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-semibold text-sm">Garmin Activiteit</p>
              <p className="text-slate-400 text-xs">Screenshot of TCX-bestand</p>
            </div>
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        </Card>

        <Card className="p-4">
          <button
            onClick={() => router.push('/settings/equipment')}
            className="flex items-center gap-3 w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Wrench size={20} className="text-green-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-semibold text-sm">Equipment</p>
              <p className="text-slate-400 text-xs">Beschikbare trainingsmiddelen</p>
            </div>
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        </Card>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Profiel</p>
          <Card>
            <Row icon={User} label="Profiel bewerken" onClick={() => router.push('/profile')} />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Target} label="Doelen beheren" onClick={() => router.push('/goals')} />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Zap} label="Blessures" onClick={() => router.push('/injuries')} />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Calendar} label="Levensgebeurtenissen" onClick={() => router.push('/life-events')} />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Info} label="Inzichten" onClick={() => router.push('/insights')} />
          </Card>
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Integraties</p>
          <Suspense fallback={<Card className="p-4 h-24 animate-pulse" />}>
            <StravaSection />
          </Suspense>
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Over</p>
          <Card>
            <Row icon={HelpCircle} label="Hoe werkt CoachOS" onClick={() => router.push('/settings/hoe-werkt-het')} />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Info} label="CoachOS" trailing={<span className="text-xs text-slate-500">{versie ? `v${versie}` : ''}</span>} />
          </Card>
        </div>

        <Card>
          <Row icon={Bug} label="Debug diagnostiek" onClick={() => router.push('/debug')} />
        </Card>

        <button onClick={signOut} className="flex items-center gap-3 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <LogOut size={18} />
          <span className="font-medium">Uitloggen</span>
        </button>
      </div>
    </AppShell>
  )
}

function Row({ icon: Icon, label, trailing, onClick }: { icon: React.ElementType; label: string; trailing?: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 px-4 py-4 w-full active:bg-slate-800">
      <Icon size={18} className="text-slate-400 flex-shrink-0" />
      <span className="flex-1 text-left text-sm text-slate-200">{label}</span>
      {trailing || <ChevronRight size={16} className="text-slate-600" />}
    </button>
  )
}
