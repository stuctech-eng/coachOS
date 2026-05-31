'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      await authService.signIn(email, password)
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-coach-dark safe-top">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">CoachOS</h1>
          <p className="text-slate-400 mt-1 text-sm">Jouw persoonlijke AI coach</p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          <Input
            label="E-mailadres"
            type="email"
            placeholder="naam@email.nl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
          <Input
            label="Wachtwoord"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
          )}

          <Button
            onClick={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            className="mt-2"
          >
            Inloggen
          </Button>

          <Link
            href="/reset-password"
            className="text-center text-sm text-slate-400 hover:text-primary-400 transition-colors py-2"
          >
            Wachtwoord vergeten?
          </Link>
        </div>
      </div>

      {/* Register link */}
      <div className="px-6 pb-8 safe-bottom">
        <p className="text-center text-sm text-slate-500">
          Nog geen account?{' '}
          <Link href="/register" className="text-primary-400 font-medium">
            Registreren
          </Link>
        </p>
      </div>
    </div>
  )
}
