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

function weerAdvies(temp: number, code: number, wind: number, gevoelstemp: number, luchtvochtigheid: number, windstoten: number, uvIndex: number): string {
  const adviezen: string[] = []
  // v2.4.182: gevoelstemperatuur leidend i.p.v. kale temperatuur —
  // relevanter voor inspanningsadvies. Hoge luchtvochtigheid verhoogt
  // hitte-stress bij dezelfde temperatuur (publiek bekend fysiologisch
  // principe, geen eigen claim).
  if (gevoelstemp >= 32) adviezen.push('Extreme hitte — train vroeg of binnen, hydrateer extra')
  else if (gevoelstemp >= 28) adviezen.push('Warm weer — verminder intensiteit buiten, drink veel')
  else if (gevoelstemp >= 25) adviezen.push('Warm — let op hydratatie bij buitentraining')
  else if (gevoelstemp <= 0) adviezen.push('Vriespunt — let op gladheid, warm goed op')
  else if (gevoelstemp <= 5) adviezen.push('Koud — langere warming-up nodig')
  if (temp >= 20 && luchtvochtigheid >= 75) adviezen.push('Hoge luchtvochtigheid — voelt zwaarder aan dan de temperatuur alleen doet vermoeden')
  if (code >= 80) adviezen.push('Buien verwacht — overweeg binnentraining')
  else if (code >= 60) adviezen.push('Regen — pas je kleding aan of train binnen')
  // Windstoten zijn relevanter dan gemiddelde wind, vooral voor hardlopen/fietsen
  if (windstoten >= 60) adviezen.push('Zware windstoten — extra voorzichtig bij fietsen')
  else if (wind >= 50) adviezen.push('Harde wind — hardlopen extra zwaar')
  else if (wind >= 30) adviezen.push('Stevige wind — pas pace aan bij hardlopen')
  if (uvIndex >= 8) adviezen.push('Zeer hoge UV — zonbescherming aanbevolen bij lange buitentraining')
  else if (uvIndex >= 6) adviezen.push('Hoge UV — smeer in bij langere buitentraining')
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
    const url = new URL(req.url)
    const gpsLat = url.searchParams.get('lat')
    const gpsLon = url.searchParams.get('lon')

    let lat = 52.37
    let lon = 4.89
    let stad = 'Amsterdam'
    let locatieBron: 'gps' | 'vercel-headers' | 'ipapi' | 'fallback' = 'fallback'

    // v2.4.168-FIX: GPS heeft ALTIJD voorrang boven IP-locatie. IP-
    // gebaseerde locatiebepaling (ipapi.co) is onbetrouwbaar zodra je
    // reist — mobiele providers routeren vaak via een vast regionaal
    // knooppunt (bijv. Venlo), dat dan als "jouw locatie" werd gebruikt,
    // ook duizenden kilometers verderop. Zie overleg 22 juli 2026,
    // bevestigd werkend in de praktijk.
    if (gpsLat && gpsLon && !isNaN(parseFloat(gpsLat)) && !isNaN(parseFloat(gpsLon))) {
      lat = parseFloat(gpsLat)
      lon = parseFloat(gpsLon)
      locatieBron = 'gps'
      // Plaatsnaam bij GPS-coördinaten is optioneel — reverse geocoding
      // zou een extra externe aanroep vergen. Toon voorlopig "Huidige
      // locatie" i.p.v. een stadsnaam; kan later verfijnd worden.
      stad = 'Huidige locatie'
    } else {
      // v2.4.181-FIX: Vercel's eigen geo-headers eerst proberen — deze
      // worden door Vercel's edge-netwerk zelf berekend op basis van het
      // daadwerkelijke client-IP, betrouwbaarder dan onze eigen ipapi.co-
      // lookup op basis van x-forwarded-for (die soms een proxy-/server-
      // IP oplevert i.p.v. de echte client-IP — bijv. "Ashburn, Virginia",
      // een bekend AWS/Vercel-datacenter, i.p.v. de werkelijke locatie).
      const vercelLat = req.headers.get('x-vercel-ip-latitude')
      const vercelLon = req.headers.get('x-vercel-ip-longitude')
      const vercelCity = req.headers.get('x-vercel-ip-city')

      if (vercelLat && vercelLon && !isNaN(parseFloat(vercelLat)) && !isNaN(parseFloat(vercelLon))) {
        lat = parseFloat(vercelLat)
        lon = parseFloat(vercelLon)
        stad = vercelCity ? decodeURIComponent(vercelCity) : 'Onbekend'
        locatieBron = 'vercel-headers'
      } else {
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = forwarded ? forwarded.split(',')[0].trim() : null

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
                locatieBron = 'ipapi'
              }
            }
          } catch { /* gebruik fallback — timeout of netwerkfout, niet blokkerend */ }
        }
      }
    }

    // v2.4.182: uitgebreid met gevoelstemperatuur, luchtvochtigheid,
    // neerslagkans, windstoten en UV-index — allemaal al beschikbaar bij
    // Open-Meteo, alleen nooit opgevraagd
    const weerUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weathercode,windspeed_10m,wind_gusts_10m,precipitation,uv_index&hourly=precipitation,precipitation_probability,weathercode,temperature_2m,uv_index&timezone=Europe/Amsterdam&forecast_days=1`

    // FIX v2.4.4: timeout toegevoegd — voorkomt hangende function bij trage/onbereikbare Open-Meteo
    const weerRes = await fetchWithTimeout(weerUrl, {}, 4000)
    if (!weerRes.ok) throw new Error('Open-Meteo niet beschikbaar')

    const weerData = await weerRes.json()
    const current = weerData.current
    const hourly = weerData.hourly

    const temp = Math.round(current.temperature_2m)
    const code = current.weathercode
    const wind = Math.round(current.windspeed_10m)
    // v2.4.182: nieuwe velden
    const gevoelstemp = Math.round(current.apparent_temperature)
    const luchtvochtigheid = Math.round(current.relative_humidity_2m)
    const windstoten = Math.round(current.wind_gusts_10m)
    const uvIndex = Math.round((current.uv_index ?? 0) * 10) / 10

    // Bereken regen per dagdeel
    const dagdeelRegen: Record<string, number> = { ochtend: 0, middag: 0, avond: 0 }
    const dagdeelCode: Record<string, number[]> = { ochtend: [], middag: [], avond: [] }
    // v2.4.182: neerslagkans (max per dagdeel — de meest zinvolle
    // samenvatting, niet een gemiddelde dat een korte bui wegmiddelt)
    const dagdeelKans: Record<string, number> = { ochtend: 0, middag: 0, avond: 0 }

    if (hourly?.time && hourly?.precipitation) {
      for (let i = 0; i < hourly.time.length; i++) {
        const uur = new Date(hourly.time[i]).getHours()
        const dd = dagdeel(uur)
        dagdeelRegen[dd] += hourly.precipitation[i] || 0
        if (hourly.weathercode) dagdeelCode[dd].push(hourly.weathercode[i] || 0)
        if (hourly.precipitation_probability) {
          dagdeelKans[dd] = Math.max(dagdeelKans[dd], hourly.precipitation_probability[i] || 0)
        }
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
    const advies = weerAdvies(temp, code, wind, gevoelstemp, luchtvochtigheid, windstoten, uvIndex)

    const result = {
      stad,
      temp,
      omschrijving,
      emoji: weerEmoji(code),
      wind,
      // v2.4.182: nieuwe velden — puur toevoegingen, bestaande
      // consumenten breken niet
      gevoelstemp,
      luchtvochtigheid,
      windstoten,
      uv_index: uvIndex,
      dagdelen: {
        ochtend: { regen: ochtendRegen, code: ochtendCode, label: formatDagdeel(ochtendRegen, ochtendCode), kans: Math.round(dagdeelKans.ochtend) },
        middag: { regen: middagRegen, code: middagCode, label: formatDagdeel(middagRegen, middagCode), kans: Math.round(dagdeelKans.middag) },
        avond: { regen: avondRegen, code: avondCode, label: formatDagdeel(avondRegen, avondCode), kans: Math.round(dagdeelKans.avond) },
      },
      advies,
      coach_context: `Weer in ${stad}: ${temp}°C (voelt als ${gevoelstemp}°C), ${omschrijving}, wind ${wind} km/u (stoten tot ${windstoten}), luchtvochtigheid ${luchtvochtigheid}%, UV-index ${uvIndex}. Ochtend: ${ochtendRegen}mm (${Math.round(dagdeelKans.ochtend)}% kans), Middag: ${middagRegen}mm (${Math.round(dagdeelKans.middag)}% kans), Avond: ${avondRegen}mm (${Math.round(dagdeelKans.avond)}% kans). ${advies}.`,
      // v2.4.181: PERMANENT (in tegenstelling tot de v2.4.168-versie die
      // na bevestiging weer verwijderd werd) — dit soort locatieproblemen
      // bleek zich te herhalen. Alleen zichtbaar via /debug, niet meer op
      // Home zelf, dus geen visuele rommel voor dagelijks gebruik.
      _locatie_debug: { bron: locatieBron, lat, lon, stad },
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[weather]', err)
    return NextResponse.json({ error: 'Weer niet beschikbaar' }, { status: 500 })
  }
}
