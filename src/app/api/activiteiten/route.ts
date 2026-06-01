import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET — haal alle activiteit sessies op
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: sessions, error } = await supabase
      .from('activity_sessions')
      .select(`
        *,
        activities (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ sessions: sessions || [] })
  } catch (error) {
    console.error('Activiteiten ophalen fout:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

// POST — Garmin GPX/TCX import
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['gpx', 'tcx'].includes(ext || '')) {
      return NextResponse.json({ error: 'Alleen .gpx en .tcx bestanden worden ondersteund' }, { status: 400 })
    }

    const content = await file.text()
    const parsed = ext === 'gpx' ? parseGPX(content) : parseTCX(content)

    if (!parsed) {
      return NextResponse.json({ error: 'Bestand kon niet worden gelezen' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Zoek of maak activiteit aan
    let { data: activity } = await supabase
      .from('activities')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', parsed.sport)
      .single()

    if (!activity) {
      const { data: newActivity } = await supabase
        .from('activities')
        .insert({ user_id: user.id, name: parsed.sport, template_id: null })
        .select()
        .single()
      activity = newActivity
    }

    // Check duplicaat op datum + duur
    const { data: existing } = await supabase
      .from('activity_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', parsed.date)
      .eq('duration', parsed.duration)
      .eq('source', 'garmin')
      .single()

    if (existing) {
      return NextResponse.json({ message: 'Activiteit al aanwezig', imported: 0, skipped: 1 })
    }

    await supabase.from('activity_sessions').insert({
      user_id: user.id,
      activity_id: activity?.id || null,
      date: parsed.date,
      duration: parsed.duration,
      metrics: parsed.metrics,
      source: 'garmin',
      notes: file.name,
    })

    return NextResponse.json({ message: '1 activiteit geïmporteerd', imported: 1, skipped: 0 })
  } catch (error) {
    console.error('Garmin import fout:', error)
    return NextResponse.json({ error: 'Import mislukt' }, { status: 500 })
  }
}

// GPX parser
function parseGPX(content: string) {
  try {
    // Sport type
    const typeMatch = content.match(/<type>([^<]+)<\/type>/i)
    const sport = mapSportType(typeMatch?.[1] || 'Anders')

    // Datum
    const timeMatch = content.match(/<time>([^<]+)<\/time>/i)
    const date = timeMatch ? timeMatch[1].split('T')[0] : new Date().toISOString().split('T')[0]

    // Trackpoints voor berekeningen
    const trkpts = content.match(/<trkpt[^>]*>[\s\S]*?<\/trkpt>/g) || []

    // Duur: eerste en laatste timestamp
    const times = content.match(/<time>([^<]+)<\/time>/g) || []
    let duration = 0
    if (times.length >= 2) {
      const start = new Date(times[0].replace(/<\/?time>/g, ''))
      const end = new Date(times[times.length - 1].replace(/<\/?time>/g, ''))
      duration = Math.round((end.getTime() - start.getTime()) / 60000)
    }

    // Afstand via lat/lon berekening
    let distance = 0
    const coords: { lat: number; lon: number }[] = []
    for (const pt of trkpts) {
      const latMatch = pt.match(/lat="([^"]+)"/)
      const lonMatch = pt.match(/lon="([^"]+)"/)
      if (latMatch && lonMatch) {
        coords.push({ lat: parseFloat(latMatch[1]), lon: parseFloat(lonMatch[1]) })
      }
    }
    for (let i = 1; i < coords.length; i++) {
      distance += haversine(coords[i - 1], coords[i])
    }

    // Hartslag
    const hrValues = [...content.matchAll(/<ns3:hr>(\d+)<\/ns3:hr>|<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/g)]
      .map(m => parseInt(m[1] || m[2]))
      .filter(v => !isNaN(v))
    const avg_hr = hrValues.length ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : undefined
    const max_hr = hrValues.length ? Math.max(...hrValues) : undefined

    // Hoogte
    const eleValues = [...content.matchAll(/<ele>([^<]+)<\/ele>/g)]
      .map(m => parseFloat(m[1]))
      .filter(v => !isNaN(v))
    let elevation = 0
    for (let i = 1; i < eleValues.length; i++) {
      const diff = eleValues[i] - eleValues[i - 1]
      if (diff > 0) elevation += diff
    }

    const metrics: Record<string, number> = {}
    if (distance > 10) metrics.distance = Math.round(distance)
    if (avg_hr) metrics.avg_hr = avg_hr
    if (max_hr) metrics.max_hr = max_hr
    if (elevation > 0) metrics.elevation = Math.round(elevation)
    if (distance > 0 && duration > 0) metrics.avg_speed = Math.round((distance / 1000) / (duration / 60) * 10) / 10

    return { sport, date, duration, metrics }
  } catch {
    return null
  }
}

// TCX parser
function parseTCX(content: string) {
  try {
    const sportMatch = content.match(/Sport="([^"]+)"/i)
    const sport = mapSportType(sportMatch?.[1] || 'Anders')

    const timeMatch = content.match(/<Id>([^<]+)<\/Id>/i)
    const date = timeMatch ? timeMatch[1].split('T')[0] : new Date().toISOString().split('T')[0]

    // Totale tijd in seconden
    const totalTimeMatch = content.match(/<TotalTimeSeconds>([^<]+)<\/TotalTimeSeconds>/i)
    const duration = totalTimeMatch ? Math.round(parseFloat(totalTimeMatch[1]) / 60) : 0

    // Afstand
    const distanceMatch = content.match(/<DistanceMeters>([^<]+)<\/DistanceMeters>/i)
    const distance = distanceMatch ? parseFloat(distanceMatch[1]) : 0

    // Hartslag
    const avgHrMatch = content.match(/<AverageHeartRateBpm>[\s\S]*?<Value>(\d+)<\/Value>/i)
    const maxHrMatch = content.match(/<MaximumHeartRateBpm>[\s\S]*?<Value>(\d+)<\/Value>/i)
    const avg_hr = avgHrMatch ? parseInt(avgHrMatch[1]) : undefined
    const max_hr = maxHrMatch ? parseInt(maxHrMatch[1]) : undefined

    // Calorieën
    const calMatch = content.match(/<Calories>(\d+)<\/Calories>/i)
    const calories = calMatch ? parseInt(calMatch[1]) : undefined

    const metrics: Record<string, number> = {}
    if (distance > 10) metrics.distance = Math.round(distance)
    if (avg_hr) metrics.avg_hr = avg_hr
    if (max_hr) metrics.max_hr = max_hr
    if (calories) metrics.calories = calories
    if (distance > 0 && duration > 0) metrics.avg_speed = Math.round((distance / 1000) / (duration / 60) * 10) / 10

    return { sport, date, duration, metrics }
  } catch {
    return null
  }
}

function mapSportType(type: string): string {
  const map: Record<string, string> = {
    running: 'Hardlopen', run: 'Hardlopen',
    cycling: 'Fietsen', biking: 'Fietsen', ride: 'Fietsen',
    walking: 'Wandelen', hiking: 'Wandelen',
    swimming: 'Zwemmen',
    rowing: 'Roeien',
    yoga: 'Yoga',
    strength_training: 'Krachttraining', weights: 'Krachttraining',
  }
  return map[type.toLowerCase()] || type
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lon - a.lon) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
