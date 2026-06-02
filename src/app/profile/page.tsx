'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { useUserStore } from '@/store'

type Gender = 'man' | 'vrouw' | 'anders' | 'zeg ik liever niet'
type ExperienceLevel = 'beginner' | 'gemiddeld' | 'gevorderd'
type AvailableTime = '15min' | '30min' | '60min' | 'flexibel'

interface FormData {
  first_name: string
  display_name: string
  age: string
  height: string
  weight: string
  gender: Gender | ''
  experience_level: ExperienceLevel | ''
  available_time: AvailableTime | ''
  injury_history: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { setProfile } = useUserStore()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<FormData>({
    first_name: '',
    display_name: '',
    age: '',
    height: '',
    weight: '',
    gender: '',
    experience_level: '',
    available_time: '',
    injury_history: '',
  })

  // Laad altijd verse data direct van API
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        const p = data.profile
        if (p) {
          setForm({
            first_name: p.first_name || '',
            display_name: p.display_name || '',
            age: p.age?.toString() || '',
            height: p.height?.toString() || '',
            weight: p.weight?.toString() || '',
            gender: p.gender || '',
            experience_level: p.experience_level || '',
            available_time: p.available_time || '',
            injury_history: p.injury_history || '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const opslaan = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          display_name: form.display_name || form.first_name,
          age: form.age ? Number(form.age) : null,
          height: form.height ? Number(form.height) : null,
          weight: form.weight ? Number(form.weight) : null,
          gender: form.gender || null,
          experience_level: form.experience_level || null,
          available_time: form.available_time || null,
          injury_history: form.injury_history || null,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setMessage('❌ ' + data.error)
      } else {
        setProfile(data.profile)
        setMessage('✅ Opgeslagen')
        setTimeout(() => router.push('/settings'), 1000)
      }
    } catch {
      setMessage('❌ Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppShell showNav={false}>
        <div className="px-5 py-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/settings')} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
              <ArrowLeft size={20} className="text-slate-400" />
            </button>
            <h1 className="text-xl font-bold text-white">Profiel bewerken</h1>
          </div>
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-coach-card animate-pulse" />)}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/settings')} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-white">Profiel bewerken</h1>
        </div>

        {message && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3">
            <p className="text-primary-400 text-sm">{message}</p>
          </div>
        )}

        {/* Naam */}
        <Card className="p-4 flex flex-col gap-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Naam</p>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Voornaam</label>
            <input
              value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Jouw naam"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Weergavenaam</label>
            <input
              value={form.display_name}
              onChange={e => set('display_name', e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Hoe de coach je noemt"
            />
          </div>
        </Card>

        {/* Lichaam */}
        <Card className="p-4 flex flex-col gap-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Lichaam</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Leeftijd</label>
              <input
                value={form.age}
                onChange={e => set('age', e.target.value)}
                type="number"
                className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="54"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Lengte (cm)</label>
              <input
                value={form.height}
                onChange={e => set('height', e.target.value)}
                type="number"
                className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="186"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Gewicht (kg)</label>
              <input
                value={form.weight}
                onChange={e => set('weight', e.target.value)}
                type="number"
                className="w-full bg-slate-800 text-white rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="95"
              />
            </div>
          </div>

          {/* Geslacht */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Geslacht</label>
            <div className="grid grid-cols-2 gap-2">
              {(['man', 'vrouw', 'anders', 'zeg ik liever niet'] as Gender[]).map(g => (
                <button
                  key={g}
                  onClick={() => set('gender', g)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    form.gender === g
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-800 text-slate-400 active:bg-slate-700'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Training */}
        <Card className="p-4 flex flex-col gap-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Training</p>

          <div>
            <label className="text-xs text-slate-400 mb-2 block">Ervaringsniveau</label>
            <div className="grid grid-cols-3 gap-2">
              {(['beginner', 'gemiddeld', 'gevorderd'] as ExperienceLevel[]).map(e => (
                <button
                  key={e}
                  onClick={() => set('experience_level', e)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    form.experience_level === e
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-800 text-slate-400 active:bg-slate-700'
                  }`}
                >
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-2 block">Beschikbare tijd</label>
            <div className="grid grid-cols-2 gap-2">
              {(['15min', '30min', '60min', 'flexibel'] as AvailableTime[]).map(t => (
                <button
                  key={t}
                  onClick={() => set('available_time', t)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    form.available_time === t
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-800 text-slate-400 active:bg-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Blessures */}
        <Card className="p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Blessuregeschiedenis</p>
          <textarea
            value={form.injury_history}
            onChange={e => set('injury_history', e.target.value)}
            className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            placeholder="Beschrijf eventuele blessures of aandachtspunten..."
            rows={3}
          />
        </Card>

        {/* Opslaan */}
        <Button onClick={opslaan} loading={saving} fullWidth>
          <Save size={16} className="mr-2" />
          Opslaan
        </Button>

      </div>
    </AppShell>
  )
}
