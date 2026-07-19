'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { browserClient } from '@/lib/supabase'
import { Button, Input } from '@/components/ui'

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches
  return iosStandalone || !!displayModeStandalone
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fase, setFase] = useState<'aanvragen' | 'instellen' | 'klaar' | 'checking'>('checking')
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [bevestig, setBevestig] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bericht, setBericht] = useState('')
  const [toonPwaUitleg, setToonPwaUitleg] = useState(false)

  useEffect(() => {
    const checkRecovery = async () => {
      const hash = window.location.hash
      const code = searchParams.get('code')

      if (hash && hash.includes('type=recovery')) {
        const { data: { subscription } } = browserClient.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
            setFase('instellen')
            subscription.unsubscribe()
          }
        })
        setTimeout(() => {
          setFase(f => f === 'checking' ? 'aanvragen' : f)
        }, 3000)
        return () => subscription.unsubscribe()
      }

      if (code) {
        const { data, error } = await browserClient.auth.exchangeCodeForSession(code)
        if (error) {
          // PKCE verifier ontbreekt typisch wanneer de link buiten Safari is geopend
          // (bv. in de Mail-app's eigen browser, of vanuit de PWA-context)
          const isPkceIssue = error.message.toLowerCase().includes('code verifier')
          if (isPkceIssue) {
            setToonPwaUitleg(true)
            setError('Deze link kan niet in deze omgeving worden geopend.')
          } else {
            setError(`Reset-link kon niet worden verwerkt: ${error.message}. Vraag een nieuwe link aan.`)
          }
          setFase('aanvragen')
          return
        }
        if (data.session) {
          setFase('instellen')
        } else {
          setError('Geen sessie ontvangen. Vraag een nieuwe reset-link aan.')
          setFase('aanvragen')
        }
        return
      }

      const { data: { session } } = await browserClient.auth.getSession()
      if (session) {
        setFase('instellen')
      } else {
        setFase('aanvragen')
      }
    }

    checkRecovery()
  }, [searchParams])

  async function aanvragen() {
    if (!email) return
    setLoading(true)
    setError('')
    setToonPwaUitleg(false)
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
    <div className="h-screen flex flex-col bg-coach-dark safe-top overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">CoachOS</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {fase === 'checking' && 'Bezig met controleren...'}
            {fase === 'aanvragen' && 'Wachtwoord vergeten'}
            {fase === 'instellen' && 'Nieuw wachtwoord instellen'}
            {fase === 'klaar' && 'Wachtwoord gewijzigd'}
          </p>
        </div>

        {fase === 'checking' && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

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

            {/* PWA-uitleg — toont alleen als de PKCE-fout is opgetreden, of altijd in standalone modus als preventieve tip */}
            {(toonPwaUitleg || isStandalonePwa()) && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-amber-400 mb-2">⚠️ Belangrijk voor de app</p>
                <p className="text-xs text-amber-200/90 leading-relaxed mb-2">
                  De reset-link werkt niet als je hem direct opent vanuit de Mail-app. Volg deze stappen:
                </p>
                <ol className="text-xs text-amber-200/90 leading-relaxed list-decimal list-inside space-y-1">
                  <li>Open de e-mail in Mail</li>
                  <li>Houd de link lang ingedrukt</li>
                  <li>Kies <strong>&quot;Kopieer link&quot;</strong></li>
                  <li>Open <strong>Safari</strong> (niet de CoachOS app)</li>
                  <li>Plak de link in de adresbalk en open hem</li>
                </ol>
              </div>
            )}

            <Button onClick={aanvragen} loading={loading} fullWidth size="lg" className="mt-2">
              Reset link versturen
            </Button>
            <Link href={'/login'}
              className="text-center text-sm text-slate-400 py-2"
            >
              Terug naar inloggen
            </Link>
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
