'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { browserClient } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fase, setFase] = useState<'aanvragen' | 'instellen' | 'klaar'>('aanvragen')
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [bevestig, setBevestig] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bericht, setBericht] = useState('')

  useEffect(() => {
    // Supabase stuurt token via hash fragment: #access_token=...&type=recovery
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      // Supabase verwerkt de hash automatisch via onAuthStateChange
      const { data: { subscription } } = browserClient.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setFase('instellen')
          subscription.unsubscribe()
        }
      })
      return () => subscription.unsubscribe()
    }

    // Code via query param (PKCE flow)
    const code = searchParams.get('code')
    if (code) {
      browserClient.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) setFase('instellen')
      })
      return
    }

    // Check bestaande sessie
    browserClient.auth.getSession().then(({ data: { session } }) => {
      if (session) setFase('instellen')
    })
  }, [searchParams])

  async function aanvragen() {
    if (!email) return
    setLoading(true)
    setError('')
    try {
      const { error } = await browserClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setBericht('Reset link verstuurd. Controleer je mail.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versturen mislukt')
    } finally {
      setLoading(false)
    }
  }

  async function instellenNieuw() {
    if (!wachtwoord || !bevestig) return
    if (wachtwoord !== bevestig) {
      setError('Wachtwoorden komen niet overeen')
      return
    }
    if (wachtwoord.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error } = await browserClient.auth.updateUser({ password: wachtwoord })
      if (error) throw error
      setFase('klaar')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-coach-dark safe-top">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">CoachOS</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {fase === 'aanvragen' && 'Wachtwoord vergeten'}
            {fase === 'instellen' && 'Nieuw wachtwoord instellen'}
            {fase === 'klaar' && 'Wachtwoord gewijzigd'}
          </p>
        </div>

        {/* Aanvragen */}
        {fase === 'aanvragen' && (
          <div className="flex flex-col gap-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              Vul je e-mailadres in. Je ontvangt een link om je wachtwoord opnieuw in te stellen.
            </p>
            <Input
              label="E-mailadres"
              type="email"
              placeholder="naam@email.nl"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
            {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}
            {bericht && <p className="text-sm text-green-400 bg-green-500/10 rounded-xl px-4 py-3">{bericht}</p>}
            <Button onClick={aanvragen} loading={loading} fullWidth size="lg" className="mt-2">
              Reset link versturen
            </Button>
            <button
              onClick={() => router.push('/login')}
              className="text-center text-sm text-slate-400 py-2"
            >
              Terug naar inloggen
            </button>
          </div>
        )}

        {/* Nieuw wachtwoord instellen */}
        {fase === 'instellen' && (
          <div className="flex flex-col gap-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              Kies een nieuw wachtwoord van minimaal 6 tekens.
            </p>
            <Input
              label="Nieuw wachtwoord"
              type="password"
              placeholder="minimaal 6 tekens"
              value={wachtwoord}
              onChange={e => setWachtwoord(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Bevestig wachtwoord"
              type="password"
              placeholder="herhaal wachtwoord"
              value={bevestig}
              onChange={e => setBevestig(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}
            <Button onClick={instellenNieuw} loading={loading} fullWidth size="lg" className="mt-2">
              Wachtwoord opslaan
            </Button>
          </div>
        )}

        {/* Klaar */}
        {fase === 'klaar' && (
          <div className="flex flex-col gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-white font-semibold">Wachtwoord gewijzigd!</p>
            <p className="text-slate-400 text-sm">Je kunt nu inloggen met je nieuwe wachtwoord.</p>
            <Button onClick={() => router.push('/login')} fullWidth size="lg" className="mt-4">
              Inloggen
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-coach-dark">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
