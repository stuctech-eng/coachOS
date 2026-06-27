export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// WMO Weather codes
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

function weerAdvies(temp: number, code: number, wind: number, regen: number): string {
  const adviezen: string[] = []

  if (temp >= 32) adviezen.push('Extreme hitte — train vroeg of binnen, hydrateer extra')
  else if (temp >= 28) adviezen.push('Warm weer — verminder intensiteit buiten, drink veel')
  else if (temp >= 25) adviezen.push('Warm — let op hydratatie bij buitentraining')
  else if (temp <= 0) adviezen.push('Vriespunt — let op gladheid, warm goed op')
  else if (temp <= 5) adviezen.push('Koud — langere warming-up nodig')

  if (code >= 80) adviezen.push('Buien verwacht — overweeg binnentraining')
  else if (code >= 60) adviezen.push('Regen — pas je kleding aan of train binnen')
  else if (code >= 51) adviezen.push('Motregen — niet ideaal voor buiten')

  if (wind >= 50) adviezen.push('Harde wind — hardlopen extra zwaar')
  else if (wind >= 30) adviezen.push('Stevige wind — pas pace aan bij hardlopen')

  if (adviezen.length === 0) return 'Goede weersomstandigheden voor training'
  return adviezen.join('. ')
}

export async function GET(req: NextRequest) {
  try {
    // Haal IP op van request
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : null

    // Stap 1: IP → coördinaten via ipapi.co (gratis, geen key)
    let lat = 52.37  // Amsterdam fallback
    let lon = 4.89
    let stad = 'Amsterdam'

    if (ip && ip !== '127.0.0.1' && !ip.startsWith('192.168') && !ip.startsWith('::1')) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { 'User-Agent': 'CoachOS/1.0' },
        })
        if (geoRes.ok) {
          const geo = await geoRes.json()
          if (geo.latitude && geo.longitude) {
            lat = geo.latitude
            lon = geo.longitude
            stad = geo.city || geo.region || 'Onbekend'
          }
        }
      } catch { /* gebruik fallback */ }
    }

    // Stap 2: Coördinaten → weer via Open-Meteo (gratis, geen key)
    const weerUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,precipitation&timezone=Europe/Amsterdam&forecast_days=1`

    const weerRes = await fetch(weerUrl)
    if (!weerRes.ok) throw new Error('Open-Meteo niet beschikbaar')

    const weerData = await weerRes.json()
    const current = weerData.current

    const temp = Math.round(current.temperature_2m)
    const code = current.weathercode
    const wind = Math.round(current.windspeed_10m)
    const regen = current.precipitation || 0

    const omschrijving = weerOmschrijving(code)
    const advies = weerAdvies(temp, code, wind, regen)

    const result = {
      stad,
      temp,
      omschrijving,
      wind,
      regen,
      advies,
      // Compact voor coach context
      coach_context: `Weer in ${stad}: ${temp}°C, ${omschrijving}, wind ${wind} km/u${regen > 0 ? `, neerslag ${regen}mm` : ''}. ${advies}.`,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[weather]', err)
    return NextResponse.json({ error: 'Weer niet beschikbaar' }, { status: 500 })
  }
}
