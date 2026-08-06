'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Concept2-webhook Debug Simulator ─────────────────────────────────────
// Bron: v2.4.286 (Concept2-webhook). Test dezelfde concept2_user_id-
// lookup + verwerkingslogica als de echte webhook — test NIET het
// geheime pad-segment zelf (CONCEPT2_WEBHOOK_SECRET), dat vergt een
// echte externe HTTP-aanroep, zie de toelichting onderaan dit scherm.

interface StatusData {
  concept2Gekoppeld: boolean
  concept2UserId: number | null
  klaarVoorWebhook: boolean
}
interface TestResultaat {
  stap: string
  geslaagd: boolean
  reden?: string
  uitkomst?: { status: string; activiteitId?: string; foutmelding?: string }
  concept2UserIdGebruikt?: number
}

export default function Concept2WebhookDebugPage() {
  const [laden, setLaden] = useState(true)
  const [status, setStatus] = useState<StatusData | null>(null)
  const [bezig, setBezig] = useState(false)
  const [resultaat, setResultaat] = useState<TestResultaat | null>(null)

  const laadStatus = useCallback(async () => {
    setLaden(true)
    try {
      const res = await fetch('/api/debug/concept2-webhook', { credentials: 'include' })
      setStatus(await res.json())
    } catch {
      // stil falen — dit is een debug-scherm
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => { laadStatus() }, [laadStatus])

  async function testWebhook() {
    setBezig(true)
    setResultaat(null)
    try {
      const res = await fetch('/api/debug/concept2-webhook', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duurMinuten: 30 }),
      })
      setResultaat(await res.json())
    } catch {
      // stil falen
    } finally {
      setBezig(false)
    }
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/debug" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Concept2-webhook Debug</h1>
            <p className="text-xs text-slate-500">simuleert een binnenkomende webhook-call</p>
          </div>
        </div>

        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Stap 1 — koppelingsstatus</p>
          {laden ? (
            <div className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p className={status?.concept2Gekoppeld ? 'text-green-400' : 'text-red-400'}>
                {status?.concept2Gekoppeld ? '✓' : '✗'} Concept2 gekoppeld
              </p>
              <p className={status?.klaarVoorWebhook ? 'text-green-400' : 'text-amber-400'}>
                {status?.klaarVoorWebhook ? '✓' : '⚠'} concept2_user_id: {status?.concept2UserId ?? 'leeg'}
              </p>
              {!status?.klaarVoorWebhook && (
                <p className="text-xs text-amber-400 mt-1">
                  Leeg concept2_user_id → de echte webhook zou deze gebruiker niet herkennen.
                  Verbreek en herverbind de Concept2-koppeling op /coach/rowing om dit te vullen.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Stap 2 — test de verwerking</p>
          <button
            onClick={testWebhook}
            disabled={bezig || !status?.klaarVoorWebhook}
            className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium active:bg-primary-700 disabled:opacity-50"
          >
            {bezig ? '⏳ Bezig...' : '▶ Simuleer webhook (30 min Roeien, vandaag)'}
          </button>

          {resultaat && (
            <div className={`mt-4 px-3 py-2.5 rounded-lg text-sm ${resultaat.geslaagd ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <p className="font-medium">{resultaat.geslaagd ? '✓ Verwerking geslaagd' : '✗ ' + resultaat.stap}</p>
              {resultaat.reden && <p className="opacity-80 mt-1 text-xs">{resultaat.reden}</p>}
              {resultaat.uitkomst && (
                <p className="opacity-80 mt-1 text-xs">
                  status: {resultaat.uitkomst.status}
                  {resultaat.uitkomst.foutmelding && ` — ${resultaat.uitkomst.foutmelding}`}
                </p>
              )}
            </div>
          )}
        </Card>

        <p className="text-[10px] text-slate-600">
          Test NIET het geheime pad-segment (CONCEPT2_WEBHOOK_SECRET) van de echte webhook-URL —
          dat vergt een echte externe HTTP-aanroep, niet iets wat een ingelogd debug-scherm zinvol
          kan nadoen zonder de beveiliging zelf te omzeilen. Wat hier WEL getest wordt: de
          concept2_user_id-lookup en de volledige verwerking (insert/matching/Coach Decision
          Engine/dedup), via exact dezelfde functie die de echte webhook ook aanroept.
        </p>
      </div>
    </AppShell>
  )
}
