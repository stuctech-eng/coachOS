export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

function weerOmschrijving(code: number): string {
  if (code === 0) return 'Helder'
  if (code === 1) return 'Overwegend helder'
  if (code === 2) return 'Gedeeltelijk bewolkt'
  if (code === 3) return 'Bewolkt'
  if (code <= 49) return 'Mist'
  if (code <= 59) return 'Motregen'
  if (code <= 69) return 'Regen'
  if (code <= 79) return 'Sneeuw'
  if (code <= 84) return 'Buien'
  if (code <= 99) return 'Onweer'
  return 'Onbekend'
}

function weerEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code === 3) return '☁️'
  if (code <= 49) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 84) return '🌦️'
  return '⛈️'
}

function weerAdvies(temp: number, code: number, wind: number): string {
  const adviezen: string[] = []
  if (temp >= 32) adviezen.push('Extreme hitte — train vroeg of binnen, hydrateer extra')
  else if (temp >= 28) adviezen.push('Warm weer — verminder intensiteit buiten, drink veel')
  else if (temp >= 25) adviezen.push('Warm — let op hydratatie bij buitentraining')
  else if (temp <= 0) adviezen.push('Vriespunt — let op gladheid, warm goed op')
  else if (temp <= 5) adviezen.push('Koud — langere warming-up nodig')
  if (code >= 80) adviezen.push('Buien verwacht — overweeg binnentraining')
  else if (code >= 60) adviezen.push('Regen — pas je kleding aan of train binnen')
  if (wind >= 50) adviezen.push('Harde wind — hardlopen extra zwaar')
  else if (wind >= 30) adviezen.push('Stevige wind — pas pace aan bij hardlopen')
  if (adviezen.length === 0) return 'Goede weersomstandigheden voor training'
  return adviezen.join('. ')
}

function dagdeel(uur: number): 'ochtend' | 'middag' | 'avond' {
  if (uur < 12) return 'ochtend'
  if (uur < 18) return 'middag'
  return 'avond'
}

export async function GET(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : null

    let lat = 52.37
    let lon = 4.89
    let stad = 'Amsterdam'

    if (ip && ip !== '127.0.0.1' && !ip.startsWith('192.168') && !ip.startsWith('::1')) {
      try {
        // FIX v2.4.4: timeout toegevoegd — voorkomt hangende function bij trage geo-lookup
        const geoRes = await fetchWithTimeout(
          `https://ipapi.co/${ip}/json/`,
          { headers: { 'User-Agent': 'CoachOS/1.0' } },
          3000
        )
        if (geoRes.ok) {
          const geo = await geoRes.json()
          if (geo.latitude && geo.longitude) {
            lat = geo.latitude
            lon = geo.longitude
            stad = geo.city || geo.region || 'Onbekend'
          }
        }
      } catch { /* gebruik fallback — timeout of netwerkfout, niet blokkerend */ }
    }

    // Open-Meteo met uurlijkse data voor ochtend/middag/avond
    const weerUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,precipitation&hourly=precipitation,weathercode,temperature_2m&timezone=Europe/Amsterdam&forecast_days=1`

    // FIX v2.4.4: timeout toegevoegd — voorkomt hangende function bij trage/onbereikbare Open-Meteo
    const weerRes = await fetchWithTimeout(weerUrl, {}, 4000)
    if (!weerRes.ok) throw new Error('Open-Meteo niet beschikbaar')

    const weerData = await weerRes.json()
    const current = weerData.current
    const hourly = weerData.hourly

    const temp = Math.round(current.temperature_2m)
    const code = current.weathercode
    const wind = Math.round(current.windspeed_10m)

    // Bereken regen per dagdeel
    const dagdeelRegen: Record<string, number> = { ochtend: 0, middag: 0, avond: 0 }
    const dagdeelCode: Record<string, number[]> = { ochtend: [], middag: [], avond: [] }

    if (hourly?.time && hourly?.precipitation) {
      for (let i = 0; i < hourly.time.length; i++) {
        const uur = new Date(hourly.time[i]).getHours()
        const dd = dagdeel(uur)
        dagdeelRegen[dd] += hourly.precipitation[i] || 0
        if (hourly.weathercode) dagdeelCode[dd].push(hourly.weathercode[i] || 0)
      }
    }

    // Rond regen af op 1 decimaal
    const ochtendRegen = Math.round(dagdeelRegen.ochtend * 10) / 10
    const middagRegen = Math.round(dagdeelRegen.middag * 10) / 10
    const avondRegen = Math.round(dagdeelRegen.avond * 10) / 10

    // Dominante weercode per dagdeel
    const dominantCode = (codes: number[]) => codes.length > 0
      ? codes.sort((a, b) => codes.filter(v => v === b).length - codes.filter(v => v === a).length)[0]
      : code

    const ochtendCode = dominantCode(dagdeelCode.ochtend)
    const middagCode = dominantCode(dagdeelCode.middag)
    const avondCode = dominantCode(dagdeelCode.avond)

    const formatDagdeel = (mm: number, wcode: number) => {
      if (mm > 0) return `${weerEmoji(wcode)} ${mm}mm`
      return weerEmoji(wcode)
    }

    const omschrijving = weerOmschrijving(code)
    const advies = weerAdvies(temp, code, wind)

    const result = {
      stad,
      temp,
      omschrijving,
      emoji: weerEmoji(code),
      wind,
      dagdelen: {
        ochtend: { regen: ochtendRegen, code: ochtendCode, label: formatDagdeel(ochtendRegen, ochtendCode) },
        middag: { regen: middagRegen, code: middagCode, label: formatDagdeel(middagRegen, middagCode) },
        avond: { regen: avondRegen, code: avondCode, label: formatDagdeel(avondRegen, avondCode) },
      },
      advies,
      coach_context: `Weer in ${stad}: ${temp}°C, ${omschrijving}, wind ${wind} km/u. Ochtend: ${ochtendRegen}mm, Middag: ${middagRegen}mm, Avond: ${avondRegen}mm. ${advies}.`,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[weather]', err)
    return NextResponse.json({ error: 'Weer niet beschikbaar' }, { status: 500 })
  }
}
