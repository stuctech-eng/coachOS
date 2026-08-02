import type { UniversalAthleteState, UniverseleWaarde, KwalitatiefNiveau, ConfidenceNiveau } from './types'

// ── CoachOS Universal Athlete Platform — Universal Impact Engine ────────
// Bron: Universal Athlete Platform Master Architecture, 2 augustus 2026.
// Vertaalt een voltooide specialist-sessie naar wijzigingen in de
// Universal Athlete State. Bewust GEEN sportlogica hier — de Specialist
// Adapter (later, per sport) levert al-vertaalde impact-bijdragen aan,
// deze Engine combineert ze alleen consistent met de bestaande staat.
//
// KERNREGEL: dit is een OBSERVER-laag — beschrijft/combineert, neemt
// zelf geen beslissingen (die blijven bij Intelligence Platform/Master
// Coach, latere stappen).
//
// Combinatiemodel — EERLIJK BENOEMD als een redelijk startpunt, geen
// wetenschappelijk gevalideerde formule: exponentieel voortschrijdend
// gemiddelde (nieuwe waarde = grotendeels de vorige staat, een klein
// deel de nieuwe sessie) — een bekend, eenvoudig patroon voor "hoe
// evolueert een belasting/vermoeidheid-score over tijd", maar geen
// claim van sportwetenschappelijke precisie. Confidence groeit met het
// aantal observaties, tot een plafond bepaald door de kwaliteit van de
// individuele bijdrage (zie combineerWaarde() hieronder voor de
// volledige toelichting, incl. de v2.4.245-fix van dit gedrag).

/** Wat een Specialist Adapter aanlevert voor één dimensie van de
 * Universal Athlete State — AL vertaald naar universele taal, deze
 * Engine kent zelf geen FTP/SPM/pace. */
export interface ImpactBijdrage {
  /** Dot-pad naar het veld, bijv. 'cardiovasculair.aerobic_load' —
   * bewust flat/string-based i.p.v. diepe type-gymnastiek, matcht de
   * pragmatische stijl van de rest van CoachOS' engines */
  pad: string
  /** 0-100, hoe zwaar deze sessie deze dimensie belast/beïnvloedt */
  impactWaarde: number
  confidence: ConfidenceNiveau
  confidence_score: number
}

const NIVEAU_GRENZEN: { grens: number; niveau: KwalitatiefNiveau }[] = [
  { grens: 20, niveau: 'zeer_laag' },
  { grens: 40, niveau: 'laag' },
  { grens: 60, niveau: 'gemiddeld' },
  { grens: 80, niveau: 'hoog' },
  { grens: 101, niveau: 'zeer_hoog' },
]

function waardeNaarNiveau(waarde: number): KwalitatiefNiveau {
  const gevonden = NIVEAU_GRENZEN.find(g => waarde < g.grens)
  return gevonden ? gevonden.niveau : 'zeer_hoog'
}

function confidenceScoreNaarNiveau(score: number): ConfidenceNiveau {
  if (score < 30) return 'LOW'
  if (score < 65) return 'MEDIUM'
  return 'HIGH'
}

/** Combineert een bestaande UniverseleWaarde met een nieuwe impact-
 * bijdrage. DECAY_GEWICHT bepaalt hoeveel gewicht de NIEUWE sessie
 * krijgt t.o.v. de bestaande staat (0.3 = de nieuwe sessie telt voor
 * 30% mee, de bestaande staat blijft voor 70% bepalend - voorkomt dat
 * een sessie de hele staat omgooit).
 *
 * v2.4.245-FIX: confidence-logica herzien. De oorspronkelijke opzet
 * (confidence = altijd de laagste van bestaand/nieuw) zorgde ervoor
 * dat confidence NOOIT boven het startpunt kon uitkomen, ook niet na
 * tientallen sessies - in tegenspraak met de UI-tekst "hoe meer
 * sessies, hoe hoger de confidence" (gevonden tijdens het testen van
 * een terugvul-functie voor 56 bestaande sessies). Nu: confidence
 * groeit met aantal_observaties, maar met de bijdrage's EIGEN
 * confidence_score als eerlijk plafond - een reeks MEDIUM-kwaliteit-
 * observaties kan nooit tot HIGH-confidence oplopen, ongeacht het
 * aantal sessies. Dat plafond weerspiegelt de kwaliteit van de
 * individuele meting, niet de hoeveelheid data. */
const DECAY_GEWICHT = 0.3
const CONFIDENCE_GROEI_PER_OBSERVATIE = 7
const CONFIDENCE_STARTPUNT = 15

export function combineerWaarde(bestaand: UniverseleWaarde | undefined, bijdrage: ImpactBijdrage): UniverseleWaarde {
  const bestaandeRuweWaarde = bestaand?.ruweWaarde ?? bijdrage.impactWaarde
  const nieuweRuweWaarde = Math.round(bestaandeRuweWaarde * (1 - DECAY_GEWICHT) + bijdrage.impactWaarde * DECAY_GEWICHT)

  const aantalObservaties = (bestaand?.aantal_observaties ?? 0) + 1
  const groeiPlafond = bijdrage.confidence_score
  const nieuweConfidenceScore = Math.min(groeiPlafond, Math.round(CONFIDENCE_STARTPUNT + aantalObservaties * CONFIDENCE_GROEI_PER_OBSERVATIE))

  return {
    niveau: waardeNaarNiveau(nieuweRuweWaarde),
    confidence: confidenceScoreNaarNiveau(nieuweConfidenceScore),
    confidence_score: nieuweConfidenceScore,
    aantal_observaties: aantalObservaties,
    ruweWaarde: nieuweRuweWaarde,
  }
}

/** Past een lijst impact-bijdragen toe op een bestaande Universal
 * Athlete State. Retourneert een NIEUW object — muteert het origineel
 * nooit (zelfde immutability-garantie als de Workout Platform's
 * Adaptation Engine). Onbekende/foutieve paden worden overgeslagen met
 * een console.error i.p.v. een crash — een specialist-adapter-bug mag
 * nooit de hele state-update laten falen. */
export function pasImpactToe(huidigeState: UniversalAthleteState, bijdragen: ImpactBijdrage[]): UniversalAthleteState {
  const nieuweState: UniversalAthleteState = JSON.parse(JSON.stringify(huidigeState))

  for (const bijdrage of bijdragen) {
    const [categorie, veld] = bijdrage.pad.split('.')
    if (!categorie || !veld) {
      console.error('[universal-impact-engine] Ongeldig pad, overgeslagen:', bijdrage.pad)
      continue
    }
    const categorieObject = (nieuweState as unknown as Record<string, Record<string, UniverseleWaarde>>)[categorie]
    if (!categorieObject || !(veld in categorieObject)) {
      console.error('[universal-impact-engine] Onbekend pad, overgeslagen:', bijdrage.pad)
      continue
    }
    categorieObject[veld] = combineerWaarde(categorieObject[veld], bijdrage)
  }

  nieuweState.laatst_bijgewerkt = new Date().toISOString()
  return nieuweState
}
