'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LogOut, User, Target, Info, ChevronRight, Activity, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface StravaStatus {
  connected: boolean
  athlete_name: string | null
  last_sync: string | null
}

export default function SettingsPage() {
  const { profile, user, signOut } = useAuth()
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
            <Row icon={User} label="Profiel bewerken" />
            <div className="h-px bg-coach-border mx-4" />
            <Row icon={Target} label="Doelen beheren" />
          </Card>
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Integraties</p>
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Activity size={20} className="text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Strava</p>
                <p className="text-slate-400 text-xs">
                  {stravaStatus.connected
                    ? stravaStatus.athlete_name || 'Gekoppeld'
                    : 'Niet gekoppeld'}
                </p>
              </div>
              {stravaStatus.connected
                ? <CheckCircle size={18} className="text-coach-green" />
                : <XCircle size={18} className="text-slate-600" />
              }
            </div>

            {syncMessage && (
              <p className="text-xs text-primary-400 mb-3">{syncMessage}</p>
            )}

            {stravaStatus.connected ? (
              <Button
                onClick={handleStravaSync}
                loading={syncing}
                variant="secondary"
                fullWidth
                size="sm"
              >
                <RefreshCw size={14} className="mr-2" />
                Activiteiten synchroniseren
              </Button>
            ) : (
              <Button
                onClick={() => window.location.href = '/api/strava/auth'}
                variant="secondary"
                fullWidth
                size="sm"
              >
                Verbind Strava
              </Button>
            )}
          </Card>
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Over</p>
          <Card>
            <Row icon={Info} label="CoachOS" trailing={<span className="text-xs text-slate-500">v1.3.0</span>} />
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

function Row({ icon: Icon, label, trailing }: { icon: React.ElementType; label: string; trailing?: React.ReactNode }) {
  return (
    <button className="flex items-center gap-4 px-4 py-4 w-full active:bg-slate-800">
      <Icon size={18} className="text-slate-400 flex-shrink-0" />
      <span className="flex-1 text-left text-sm text-slate-200">{label}</span>
      {trailing || <ChevronRight size={16} className="text-slate-600" />}
    </button>
  )
}
