import type { ImpactBijdrage } from '@/core/athlete-platform/impact-engine'

// ── Weer Impact Adapter (Universal Athlete Platform — Omgeving) ─────────
// Bron: overleg 3 augustus 2026. Gecorrigeerd na een te snelle aanname
// ("geen weerdata beschikbaar") — er bestaat wél een uitgebreide
// weer-API (api/weather/route.ts, v2.4.182: gevoelstemperatuur,
// luchtvochtigheid, UV-index). Vult 2 van de 5 Omgeving-velden.
//
// EERLIJK, welke velden WEL en NIET gevuld worden:
// - hitte_adaptatie: JA — gevoelstemperatuur is een directe, bruikbare
//   proxy voor hitte-blootstelling tijdens een sessie
// - koude_adaptatie: JA — zelfde principe, andere richting
// - hoogte_adaptatie: NEE — geen hoogtedata beschikbaar (geen barometer/
//   GPS-hoogte in de huidige metrics)
// - hydratatie_status: NEE — geen directe hydratatie-tracking, zou een
//   te zwakke, indirecte gok zijn (luchtvochtigheid ≠ hydratatie)
// - energie_beschikbaarheid: NEE — geen voedingsdata beschikbaar
//
// Bewust GEEN aparte sport-tak — weer is sport-onafhankelijk, geldt
// evengoed voor Rowing/Running/Cycling (zolang de sessie buiten was,
// wat we niet zeker weten — zie onderstaande beperking).
//
// BELANGRIJKE BEPERKING, expliciet benoemd: dit gebruikt het WEER OP
// HET MOMENT VAN SYNCEN als proxy voor "de omstandigheden tijdens de
// sessie" — niet het historische weer op het exacte moment van de
// training zelf (dat zou een aparte, tijdstip-specifieke weer-API-call
// vergen). Bij een sessie die kort na afloop gesynchroniseerd wordt is
// dit een redelijke proxy; bij een lang-vertraagde sync (bijv. de
// eerdere backfill van 56 oude Concept2-sessies) is dit NIET accuraat
// — daarom NIET toegepast bij de terugvul-functie, alleen bij
// live syncs.

const HITTE_DREMPEL_C = 20 // vanaf hier telt het als hitte-blootstelling
const KOUDE_DREMPEL_C = 8   // vanaf hier (en lager) telt het als koude-blootstelling

export interface WeerData {
  gevoelstemp: number
}

/** Vertaalt een actuele weer-uitlezing naar impact-bijdragen voor de
 * Omgeving-categorie. Geeft een lege array terug als de temperatuur in
 * het neutrale midden zit (geen relevante hitte- of koude-blootstelling
 * om iets over te zeggen). */
export function vertaalWeerNaarImpact(weer: WeerData, bronSport: string): ImpactBijdrage[] {
  const bijdragen: ImpactBijdrage[] = []

  if (weer.gevoelstemp >= HITTE_DREMPEL_C) {
    // Schaal: bij precies de drempel een lichte impact, bij 35°C+ bijna maximaal
    const impactWaarde = Math.round(Math.min(100, ((weer.gevoelstemp - HITTE_DREMPEL_C) / 15) * 100))
    bijdragen.push({ pad: 'omgeving.hitte_adaptatie', impactWaarde, confidence: 'MEDIUM', confidence_score: 45, bronSport })
  }

  if (weer.gevoelstemp <= KOUDE_DREMPEL_C) {
    const impactWaarde = Math.round(Math.min(100, ((KOUDE_DREMPEL_C - weer.gevoelstemp) / 15) * 100))
    bijdragen.push({ pad: 'omgeving.koude_adaptatie', impactWaarde, confidence: 'MEDIUM', confidence_score: 45, bronSport })
  }

  return bijdragen
}

/** Haalt het huidige weer op via de al-bestaande, interne weather-route
 * (server-side fetch — geen lat/lon nodig, de route valt zelf terug op
 * Vercel-edge-locatie/IP-locatie/Amsterdam-fallback). Geeft null terug
 * bij een fout — de aanroeper beslist wat daarmee te doen (typisch:
 * gewoon overslaan, geen crash). */
export async function haalHuidigWeer(origin: string): Promise<WeerData | null> {
  try {
    const res = await fetch(`${origin}/api/weather`)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data.gevoelstemp !== 'number') return null
    return { gevoelstemp: data.gevoelstemp }
  } catch (err) {
    console.error('[weer-impact-adapter] Weer ophalen mislukt:', err)
    return null
  }
}
