// ── Vermogenscurve-berekening ────────────────────────────────────────────
// Bron: docs/vermogenscurve-datalaag-spec.md. VOLLEDIG DETERMINISTISCH —
// geen AI. Isomorf (geen server-only imports) — draait zowel client-side
// (binnen tcx-parser.ts, die zelf ook isomorf is) als straks server-side
// bij de Strava-streams-integratie.
//
// Tijd-gebaseerd i.p.v. een vaste sampling-interval aan te nemen — TCX-
// devices samplen niet altijd exact regelmatig (smart recording kan
// punten overslaan bij stilstand). Een two-pointer schuivend venster over
// de daadwerkelijke tijdstempels is robuuster dan uitgaan van "1 punt =
// 1 seconde".

export interface VermogensPunt {
  tijdSec: number // seconden sinds start van de activiteit
  watts: number
}

export interface VermogensCurvePunt {
  duration_sec: number
  watts: number
}

// Standaard duren voor de curve — vaste, gedocumenteerde set.
// v2.4.122: 10s, 3min (180s) en 45min (2700s) toegevoegd op verzoek —
// volledige klassieke power-curve-set (12 punten i.p.v. 9). GEEN
// terugwerkende kracht: bestaande activiteiten hebben geen ruwe
// seconde-data meer bewaard om deze drie nieuwe duren alsnog te
// berekenen (zie docs/vermogenscurve-datalaag-spec.md) — nieuwe
// duurpunten verschijnen alleen bij nieuwe Garmin-imports vanaf nu.
const CURVE_DUREN = [5, 10, 15, 30, 60, 180, 300, 600, 1200, 1800, 2700, 3600]

export function berekenVermogenscurve(reeks: VermogensPunt[]): VermogensCurvePunt[] {
  if (reeks.length < 2) return []

  // Zorg dat de reeks chronologisch gesorteerd is — data zou dat al
  // moeten zijn (trackpoints worden in volgorde verzameld), maar dit
  // is een goedkope garantie tegen een eventuele input-fout
  const gesorteerd = [...reeks].sort((a, b) => a.tijdSec - b.tijdSec)
  const totaalDuurSec = gesorteerd[gesorteerd.length - 1].tijdSec - gesorteerd[0].tijdSec

  const resultaat: VermogensCurvePunt[] = []

  for (const duurSec of CURVE_DUREN) {
    if (duurSec > totaalDuurSec) continue // activiteit te kort voor deze duur

    let besteGemiddelde = 0
    let linksIndex = 0
    let vensterSom = 0
    let vensterPunten = 0

    for (let rechtsIndex = 0; rechtsIndex < gesorteerd.length; rechtsIndex++) {
      vensterSom += gesorteerd[rechtsIndex].watts
      vensterPunten++

      while (gesorteerd[rechtsIndex].tijdSec - gesorteerd[linksIndex].tijdSec > duurSec) {
        vensterSom -= gesorteerd[linksIndex].watts
        vensterPunten--
        linksIndex++
      }

      const vensterDuur = gesorteerd[rechtsIndex].tijdSec - gesorteerd[linksIndex].tijdSec
      // Kleine marge (95%) tegen randgevallen waarbij het venster net
      // niet exact de gevraagde duur haalt door sampling-onregelmatigheid
      if (vensterDuur >= duurSec * 0.95 && vensterPunten > 0) {
        const gemiddelde = vensterSom / vensterPunten
        if (gemiddelde > besteGemiddelde) besteGemiddelde = gemiddelde
      }
    }

    if (besteGemiddelde > 0) {
      resultaat.push({ duration_sec: duurSec, watts: Math.round(besteGemiddelde) })
    }
  }

  return resultaat
}
