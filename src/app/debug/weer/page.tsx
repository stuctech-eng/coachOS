'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Weer Debug — PERMANENT ────────────────────────────────────────────
// Bron: overleg 22 juli 2026 (v2.4.168), opnieuw nodig gebleken 22 juli
// 2026 (v2.4.181, Ashburn-incident). In tegenstelling tot de vorige
// versie op Home zelf, bewust hier ondergebracht — permanent
// beschikbaar zonder Home's UI vol te zetten. Toont welke locatiebron
// daadwerkelijk gebruikt is: gps / vercel-headers / ipapi / fallback.

export default function WeerDebugPage() {
  const [laden, setLaden] = useState(true)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [gpsFout, setGpsFout] = useState<string | null>(null)

  async function laad(metGps: boolean) {
    setLaden(true)
    try {
      let url = '/api/weather'
      if (metGps && gpsCoords) url = `/api/weather?lat=${gpsCoords.lat}&lon=${gpsCoords.lon}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
    } catch { setData(null) } finally { setLaden(false) }
  }

  function vraagGps() {
    if (!navigator.geolocation) { setGpsFout('Geolocation niet ondersteund'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGpsFout(null) },
      err => {
        const redenen: Record<number, string> = { 1: 'permissie geweigerd', 2: 'positie niet beschikbaar', 3: 'timeout' }
        setGpsFout(redenen[err.code] || err.message)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  useEffect(() => { laad(false) }, [])
  useEffect(() => { if (gpsCoords) laad(true) }, [gpsCoords])

  const debugInfo = data?._locatie_debug as { bron: string; lat: number; lon: number; stad: string } | undefined

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/debug" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Weer Debug</h1>
            <p className="text-xs text-slate-500">Locatiebron-diagnose</p>
          </div>
          <button onClick={() => laad(!!gpsCoords)} disabled={laden} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10 disabled:opacity-50">
            <RefreshCw size={16} className={`text-slate-400 ${laden ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <Card className="p-4">
          <button onClick={vraagGps} className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold">
            GPS opvragen (zoals Home dat doet)
          </button>
          {gpsFout && <p className="text-xs text-red-400 mt-2">GPS mislukt: {gpsFout}</p>}
          {gpsCoords && <p className="text-xs text-green-400 mt-2">GPS ontvangen: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lon.toFixed(4)}</p>}
        </Card>

        {laden && <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && debugInfo && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Gebruikte locatiebron</p>
            <p className={`text-2xl font-bold mb-2 ${debugInfo.bron === 'gps' ? 'text-green-400' : debugInfo.bron === 'vercel-headers' ? 'text-blue-400' : debugInfo.bron === 'ipapi' ? 'text-amber-400' : 'text-red-400'}`}>
              {debugInfo.bron}
            </p>
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-slate-300">Stad: {debugInfo.stad}</p>
              <p className="text-slate-300">Lat: {debugInfo.lat}</p>
              <p className="text-slate-300">Lon: {debugInfo.lon}</p>
              <p className="text-slate-300">Temp: {String(data?.temp)}°C</p>
            </div>
            {debugInfo.bron !== 'gps' && (
              <p className="text-xs text-amber-400 mt-3">
                ⚠️ Geen GPS gebruikt — tik hierboven op &quot;GPS opvragen&quot; om te testen of GPS wél werkt.
              </p>
            )}
          </Card>
        )}

        <p className="text-[10px] text-slate-600 text-center px-4">
          bron=gps is altijd het meest betrouwbaar. bron=vercel-headers
          gebruikt Vercel&apos;s eigen edge-locatie (redelijk betrouwbaar).
          bron=ipapi is de zwakste optie (kan een proxy-/server-IP
          teruggeven i.p.v. je werkelijke locatie).
        </p>
      </div>
    </AppShell>
  )
}
