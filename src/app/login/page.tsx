'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { browserClient } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches
  return iosStandalone || !!displayModeStandalone
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const { error } = await browserClient.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      // In een standalone PWA werkt de redirect-flow onbetrouwbaar (zelfde
      // patroon als de magic-link/reset-password issues) — gebruik popup-mode
      if (isStandalonePwa()) {
        const { data, error } = await browserClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            skipBrowserRedirect: true,
          },
        })
        if (error) throw error
        if (data?.url) {
          window.location.href = data.url
        }
        return
      }

      // Gewone browser: normale redirect-flow
      const { error } = await browserClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google inloggen mislukt')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-coach-dark safe-top">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">CoachOS</h1>
          <p className="text-slate-400 mt-1 text-sm">Jouw persoonlijke AI coach</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Google Sign-In — primaire, aanbevolen methode */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-white rounded-xl font-semibold text-sm text-slate-900 active:bg-slate-100 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Bezig...' : 'Inloggen met Google'}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">of met e-mail</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <Input
            label="E-mailadres"
            type="email"
            placeholder="naam@email.nl"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
          <Input
            label="Wachtwoord"
            type="password"
            placeholder="........"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}
          <Button onClick={handleLogin} loading={loading} fullWidth size="lg" className="mt-2">
            Inloggen
          </Button>
          <Link href="/reset-password" className="text-center text-sm text-slate-400 py-2">
            Wachtwoord vergeten?
          </Link>
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          Nog geen account?{' '}
          <Link href="/register" className="text-primary-400 font-semibold">
            Registreren
          </Link>
        </p>
      </div>
    </div>
  )
}
