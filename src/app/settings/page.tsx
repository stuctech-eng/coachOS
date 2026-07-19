'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LogOut, User, Target, Info, ChevronRight, Activity, CheckCircle, XCircle, Zap, Calendar, Camera, HelpCircle, Wrench, Bug } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface StravaStatus {
  connected: boolean
  athlete_name: string | null
  last_sync: string | null
}

// v2.4.22: REBUILD van de sync-UI. Voorheen kon het resultaatbericht
// verdwijnen zonder duidelijke reden (bv. als de request nooit teruggaf
// door het ontbreken van een timeout aan de serverkant — zie
// strava/sync/route.ts). Nu: het resultaat blijft altijd zichtbaar tot de
// volgende sync-poging, en na 10 seconden zonder resultaat verschijnt een
// expliciete "dit duurt langer dan verwacht"-melding in plaats van alleen
// een spinner die eindeloos kan blijven draaien.
// v2.4.43: sterk vereenvoudigd — Sync- en Bekijk-activiteiten-knoppen zijn
// verhuisd naar /activities (zie daar), consistent met hoe Garmin-import
// al werkte sinds v2.4.40. Deze sectie toont nu alleen de koppelingsstatus
// zelf, wat een echte "instelling" is (OAuth-koppeling verbreken/maken).
function StravaSection() {
  const searchParams = useSearchParams()
  const [stravaStatus, setStravaStatus] = useState<StravaStatus>({ connected: false, athlete_name: null, last_sync: null })
  const [koppelResultaat, setKoppelResultaat] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/strava/sync', { credentials: 'include' }).then(r => r.json()).then(setStravaStatus).catch(() => {})
    const stravaParam = searchParams.get('strava')
    if (stravaParam === 'connected') setKoppelResultaat('Strava gekoppeld!')
    if (stravaParam === 'error') setKoppelResultaat('Koppeling mislukt. Probeer opnieuw.')
  }, [searchParams])

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

      {koppelResultaat && (
        <p className="text-xs text-primary-400 mb-3">{koppelResultaat}</p>
      )}

      {!stravaStatus.connected && (
        <Button onClick={() => window.location.href = '/api/strava/auth'} variant="secondary" fullWidth size="sm">
          Verbind Strava
        </Button>
      )}
      {stravaStatus.connected && (
        <p className="text-xs text-slate-500">Synchroniseren en activiteiten bekijken kan via de Activiteiten-tab.</p>
      )}
    </Card>
  )
}

export default function SettingsPage() {
  const { profile, user, signOut } = useAuth()
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
          <Link
            href="/settings/garmin-import"
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
          </Link>
        </Card>

        {/* v2.4.40: "Garmin Activiteit"-kaart verwijderd — was dubbelop
            met de nieuwe knop op /activities ("Activiteit toevoegen"),
            die naar dezelfde /settings/garmin-activity-import-pagina
            linkt. Eén duidelijke toegangsweg in plaats van twee. */}

        <Card className="p-4">
          <Link
            href="/settings/equipment"
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
          </Link>
        </Card>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Profiel</p>
          <Card>
            <Row icon={User} label="Profiel bewerken" href="/profile" />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Target} label="Doelen beheren" href="/goals" />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Zap} label="Blessures" href="/injuries" />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Calendar} label="Levensgebeurtenissen" href="/life-events" />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Info} label="Inzichten" href="/insights" />
            <Row icon={Zap} label="Cycling Profile" href="/settings/cycling-profile" />
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
            <Row icon={HelpCircle} label="Hoe werkt CoachOS" href="/settings/hoe-werkt-het" />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Info} label="CoachOS" trailing={<span className="text-xs text-slate-500">{versie ? `v${versie}` : ''}</span>} />
          </Card>
        </div>

        <Card>
          <Row icon={Bug} label="Debug diagnostiek" href="/debug" />
        </Card>

        <button onClick={signOut} className="flex items-center gap-3 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <LogOut size={18} />
          <span className="font-medium">Uitloggen</span>
        </button>
      </div>
    </AppShell>
  )
}

function Row({ icon: Icon, label, trailing, href, onClick }: { icon: React.ElementType; label: string; trailing?: React.ReactNode; href?: string; onClick?: () => void }) {
  const inhoud = (
    <>
      <Icon size={18} className="text-slate-400 flex-shrink-0" />
      <span className="flex-1 text-left text-sm text-slate-200">{label}</span>
      {trailing || (href || onClick ? <ChevronRight size={16} className="text-slate-600" /> : null)}
    </>
  )
  // v2.4.119: href geeft prefetching (sneller aanvoelende navigatie) —
  // onClick blijft bestaan voor Rows zonder navigatie (bv. puur trailing-info)
  if (href) {
    return <Link href={href} className="flex items-center gap-4 px-4 py-4 w-full active:bg-slate-800">{inhoud}</Link>
  }
  return (
    <button onClick={onClick} className="flex items-center gap-4 px-4 py-4 w-full active:bg-slate-800">
      {inhoud}
    </button>
  )
}
