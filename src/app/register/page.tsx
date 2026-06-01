'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { browserClient } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!email || !password) return
    if (password !== confirm) { setError('Wachtwoorden komen niet overeen'); return }
    if (password.length < 8) { setError('Wachtwoord minimaal 8 tekens'); return }
    setLoading(true)
    setError('')
    try {
      const { error } = await browserClient.auth.signUp({ email, password })
      if (error) throw error
      router.push('/onboarding')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registratie mislukt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-coach-dark safe-top">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">Account aanmaken</h1>
          <p className="text-slate-400 mt-1 text-sm">Start je coaching journey</p>
        </div>
        <div className="flex flex-col gap-4">
          <Input label="E-mailadres" type="email" placeholder="naam@email.nl" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
          <Input label="Wachtwoord" type="password" placeholder="Minimaal 8 tekens" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          <Input label="Wachtwoord bevestigen" type="password" placeholder="........" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}
          <Button onClick={handleRegister} loading={loading} fullWidth size="lg" className="mt-2">Account aanmaken</Button>
        </div>
      </div>
      <div className="px-6 pb-8 safe-bottom">
        <p className="text-center text-sm text-slate-500">Al een account? <Link href="/login" className="text-primary-400 font-medium">Inloggen</Link></p>
      </div>
    </div>
  )
}
