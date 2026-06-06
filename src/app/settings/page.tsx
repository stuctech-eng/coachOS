'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LogOut, User, Target, Info, ChevronRight, ChevronDown, Activity, RefreshCw, CheckCircle, XCircle, Heart, Copy, Key, Zap, Calendar, Camera } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface StravaStatus {
  connected: boolean
  athlete_name: string | null
  last_sync: string | null
}

function StravaSection() {
  const searchParams = useSearchParams()
  const [stravaStatus, setStravaStatus] = useState<StravaStatus>({ connected: false, athlete_name: null, last_sync: null })
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    fetch('/api/strava/sync').then(r => r.json()).then(setStravaStatus).catch(() => {})
    const stravaParam = searchParams.get('strava')
    if (stravaParam === 'connected') setSyncMessage('Strava gekoppeld!')
    if (stravaParam === 'error') setSyncMessage('Koppeling mislukt. Probeer opnieuw.')
  }, [searchParams])

  const handleStravaSync = async () => {
    setSyncing(true)
    setSyncMessage('')
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMessage(data.message || 'Sync klaar')
      fetch('/api/strava/sync').then(r => r.json()).then(setStravaStatus).catch(() => {})
    } catch {
      setSyncMessage('Sync mislukt')
    } finally {
      setSyncing(false)
    }
  }

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
      {syncMessage && <p className="text-xs text-primary-400 mb-3">{syncMessage}</p>}
      {stravaStatus.connected ? (
        <Button onClick={handleStravaSync} loading={syncing} variant="secondary" fullWidth size="sm">
          <RefreshCw size={14} className="mr-2" />
          Activiteiten synchroniseren
        </Button>
      ) : (
        <Button onClick={() => window.location.href = '/api/strava/auth'} variant="secondary" fullWidth size="sm">
          Verbind Strava
        </Button>
      )}
    </Card>
  )
}

function AppleHealthSection() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/health/apikey')
      .then(r => r.json())
      .then(d => setApiKey(d.key))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const generateKey = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/health/apikey', { method: 'POST' })
      const data = await res.json()
      setApiKey(data.key)
    } catch {
      //
    } finally {
      setGenerating(false)
    }
  }

  const copyKey = async () => {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const appUrl = 'https://coach-os-tau.vercel.app'

  return (
    <Card className="p-4 mt-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <Heart size={20} className="text-red-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-white font-semibold text-sm">Apple Health</p>
          <p className="text-slate-400 text-xs">Via iPhone Shortcut</p>
        </div>
        {apiKey && <CheckCircle size={18} className="text-coach-green" />}
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && loading ? (
        <div className="h-8 bg-slate-800 rounded animate-pulse mt-3" />
      ) : open && apiKey ? (
        <>
          <div className="bg-slate-900 rounded-xl p-3 mb-3 mt-3">
            <p className="text-xs text-slate-500 mb-1">API Key</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-primary-400 font-mono flex-1 truncate">{apiKey}</p>
              <button onClick={copyKey} className="flex-shrink-0 p-1.5 rounded-lg bg-slate-800 active:bg-slate-700">
                {copied
                  ? <CheckCircle size={14} className="text-coach-green" />
                  : <Copy size={14} className="text-slate-400" />
                }
              </button>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 mb-3">
            <p className="text-xs text-slate-500 mb-2">Shortcut instellen</p>
            <ol className="text-xs text-slate-400 space-y-1.5 list-none">
              <li>1. Open <span className="text-white">Opdrachten</span> app</li>
              <li>2. Tik <span className="text-white">+</span> nieuw shortcut</li>
              <li>3. Voeg toe: <span className="text-white">Gezondheid → Zoek gezondheidsmonsters</span></li>
              <li>4. Kies: Hartslagfrequentie, afgelopen 1 dag</li>
              <li>5. Herhaal voor: HRV, Stappen, Gewicht, Slaap, Actieve energie</li>
              <li>6. Voeg toe: <span className="text-white">Haal inhoud van URL op</span></li>
              <li>7. URL: <span className="text-primary-400 break-all">{appUrl}/api/health/shortcut</span></li>
              <li>8. Methode: POST, Header: x-api-key = jouw key, JSON velden koppelen</li>
              <li>9. Automatisering: elke dag 07:00</li>
            </ol>
          </div>
          <Button onClick={generateKey} loading={generating} variant="secondary" fullWidth size="sm">
            <Key size={14} className="mr-2" />
            Nieuwe API key genereren
          </Button>
        </>
      ) : open ? (
        <div className="mt-3">
          <Button onClick={generateKey} loading={generating} variant="secondary" fullWidth size="sm">
            <Key size={14} className="mr-2" />
            API key aanmaken
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

export default function SettingsPage() {
  const { profile, user, signOut } = useAuth()
  const router = useRouter()

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
          </Card>
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Integraties</p>
          <Suspense fallback={<Card className="p-4 h-24 animate-pulse" />}>
            <StravaSection />
          </Suspense>
          <AppleHealthSection />

          {/* Garmin Import */}
          <Card className="p-4 mt-3">
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
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Over</p>
          <Card>
            <Row icon={Info} label="CoachOS" trailing={<span className="text-xs text-slate-500">v4.2.0</span>} />
          </Card>
        </div>

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
