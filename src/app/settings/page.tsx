'use client'
import { LogOut, User, Target, Info, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

export default function SettingsPage() {
  const { profile, user, signOut } = useAuth()
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
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Over</p>
          <Card><Row icon={Info} label="CoachOS" trailing={<span className="text-xs text-slate-500">v1.1.0</span>} /></Card>
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
