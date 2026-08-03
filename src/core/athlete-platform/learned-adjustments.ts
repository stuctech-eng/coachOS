import type { UniversalAthleteState, UniverseleWaarde } from './types'
import { waardeNaarNiveau } from './impact-engine'

// ── Learning Rules Engine — geleerde patronen daadwerkelijk toepassen ───
// Bron: overleg 3 augustus 2026. Vervolg op v2.4.253 (evalueren + tonen).
// Deze module is de stap die daarna bewust is opengelaten: het gevonden
// patroon ook echt laten meewegen in toekomstige berekeningen, niet
// alleen zichtbaar maken.
//
// KERNREGEL, zelfde als overal in het Universal Athlete Platform: puur
// een correctie op de RUWE waarde (intern), nooit een schijnprecies
// getal naar de gebruiker. Confidence wordt NIET aangepast door een
// geleerd patroon — een geleerde correctie zegt iets over de VERWACHTE
// waarde, niet over hoeveel data er is; dat blijft een aparte, eigen
// berekening (aantal_observaties, zie impact-engine.ts).
//
// Bewust een APARTE, optionele stap (niet in combineerWaarde() zelf
// ingebakken) — een sessie-update mag altijd blijven werken, ook als
// het ophalen van geleerde patronen om wat voor reden dan ook faalt.

export interface GeleerdPatroon {
  effect_pad: string
  aanpassing_percentage: number
}

/** Past alle geleerde patronen toe op een bestaande state. Retourneert
 * een NIEUW object — muteert het origineel nooit, zelfde immutability-
 * garantie als de rest van het platform. Onbekende paden worden
 * overgeslagen met een console.error, geen crash. */
export function pasGeleerdeAanpassingenToe(state: UniversalAthleteState, patronen: GeleerdPatroon[]): UniversalAthleteState {
  if (patronen.length === 0) return state

  const nieuweState: UniversalAthleteState = JSON.parse(JSON.stringify(state))

  for (const patroon of patronen) {
    const [categorie, veld] = patroon.effect_pad.split('.')
    if (!categorie || !veld) {
      console.error('[learned-adjustments] Ongeldig pad, overgeslagen:', patroon.effect_pad)
      continue
    }
    const categorieObject = (nieuweState as unknown as Record<string, Record<string, UniverseleWaarde>>)[categorie]
    if (!categorieObject || !(veld in categorieObject)) {
      console.error('[learned-adjustments] Onbekend pad, overgeslagen:', patroon.effect_pad)
      continue
    }

    const huidigeWaarde = categorieObject[veld]
    if (huidigeWaarde.ruweWaarde === undefined) continue // niets om aan te passen

    const aangepasteRuweWaarde = Math.max(0, Math.min(100, Math.round(huidigeWaarde.ruweWaarde * (1 + patroon.aanpassing_percentage / 100))))
    categorieObject[veld] = {
      ...huidigeWaarde,
      ruweWaarde: aangepasteRuweWaarde,
      niveau: waardeNaarNiveau(aangepasteRuweWaarde),
      // confidence blijft bewust ongewijzigd — zie toelichting bovenaan
    }
  }

  return nieuweState
}
