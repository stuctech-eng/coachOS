'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface RoutePoint {
  lat: number
  lng: number
}

// v2.4.41: kaart-component met Leaflet + OpenStreetMap-tegels (gratis,
// geen API-key nodig). Puur client-side — Leaflet gebruikt `window` en
// kan niet server-side gerenderd worden, daarom wordt dit component
// altijd via next/dynamic met ssr:false geladen (zie activities/[id]/page.tsx).
export default function ActivityRouteMap({ route }: { route: RoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || route.length === 0) return

    let actief = true

    import('leaflet').then((L) => {
      if (!actief || !containerRef.current) return

      // Voorkom dubbele kaart-initialisatie bij React StrictMode/re-renders
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      // Leaflet's standaard marker-iconen verwijzen naar bestanden die in
      // een Next.js-bundel niet automatisch meekomen — expliciet instellen
      // op de CDN-versie voorkomt kapotte start/eind-markers.
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current, { attributionControl: true })
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap-bijdragers',
      }).addTo(map)

      const latLngs: [number, number][] = route.map(p => [p.lat, p.lng])
      const lijn = L.polyline(latLngs, { color: '#818cf8', weight: 4, opacity: 0.85 }).addTo(map)

      L.marker(latLngs[0]).addTo(map).bindPopup('Start')
      L.marker(latLngs[latLngs.length - 1]).addTo(map).bindPopup('Einde')

      map.fitBounds(lijn.getBounds(), { padding: [24, 24] })
    })

    return () => {
      actief = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [route])

  if (route.length === 0) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/8 p-8 text-center">
        <p className="text-sm text-white/40">Geen GPS-route beschikbaar voor deze activiteit</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-72 rounded-2xl overflow-hidden border border-white/8"
      style={{ background: '#1c2128' }}
    />
  )
}
