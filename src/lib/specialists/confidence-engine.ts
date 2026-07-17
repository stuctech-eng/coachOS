// ── Confidence Engine ────────────────────────────────────────────────────
// Bron: docs/specialist-memory.md, "Confidence Engine". VOLLEDIG
// DETERMINISTISCH — geen AI. Strikt gescheiden van de Learning Engine:
// Learning Engine beslist OF iets een kandidaat is, Confidence Engine
// beslist HOE STERK een inzicht is, en of dat over tijd blijft.
//
// Twee bewegingen, zoals vastgelegd:
// - Bevestiging → confidence STIJGT (begrensd op 100)
// - Geen bevestiging over tijd → confidence DAALT GELEIDELIJK
// - Onder een ondergrens → status automatisch naar 'deprecated'
//
// Toepassing: decay wordt LAZY berekend (bij het lezen van Memory, niet
// via een achtergrond-cronjob — dit project heeft geen bevestigde
// scheduled-job-infrastructuur, dus een bij-lezen-herberekende aanpak is
// eenvoudiger en net zo correct, aangezien confidence toch alleen
// relevant is op het moment dat iets gelezen wordt).

const CONFIDENCE_STIJGING_BIJ_BEVESTIGING = 15
const CONFIDENCE_MAX = 100
const CONFIDENCE_MIN = 0

// Hoeveel confidence-punten verloren gaan per volle week zonder
// herbevestiging — bewust een gematigd tempo, geen paniekerige daling
// bij één gemiste week
const CONFIDENCE_DALING_PER_WEEK_ZONDER_BEVESTIGING = 3

// Onder dit punt: status automatisch naar 'deprecated' (alleen van
// toepassing op items die al 'active' waren — 'candidate'-items die
// nooit bevestigd worden, blijven gewoon 'candidate' liggen totdat ze
// alsnog bevestigd worden of voor altijd genegeerd — geen noodzaak om
// die apart te deprecaten, ze waren nooit 'waarheid')
const CONFIDENCE_ONDERGRENS_DEPRECATED = 15

export function berekenNieuweConfidenceBijBevestiging(huidigeConfidence: number): number {
  return Math.min(CONFIDENCE_MAX, huidigeConfidence + CONFIDENCE_STIJGING_BIJ_BEVESTIGING)
}

export function berekenGedecayedeConfidence(huidigeConfidence: number, lastConfirmedAt: string): number {
  const dagenSindsBevestiging = Math.floor((Date.now() - new Date(lastConfirmedAt).getTime()) / (24 * 60 * 60 * 1000))
  const volleWekenSindsBevestiging = Math.floor(dagenSindsBevestiging / 7)
  const daling = volleWekenSindsBevestiging * CONFIDENCE_DALING_PER_WEEK_ZONDER_BEVESTIGING
  return Math.max(CONFIDENCE_MIN, huidigeConfidence - daling)
}

export interface HerwaardeerdItem {
  id: string
  oude_confidence: number
  nieuwe_confidence: number
  oude_status: string
  nieuwe_status: string
  gewijzigd: boolean
}

/**
 * Past decay toe op alle 'active' Memory-items van een specialist, en
 * zet items onder de ondergrens naar 'deprecated'. Schrijft alleen weg
 * wat daadwerkelijk verandert (geen onnodige writes).
 *
 * `supabase`-parameter bewust los getypeerd (niet het exacte
 * SupabaseClient-type) om geen extra import-afhankelijkheid te
 * introduceren puur voor typing — de aanroepende functie (haalMemoryOp
 * in learning-engine.ts) geeft de al-bestaande admin-client door.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function herwaardeerMemory(
  supabase: any,
  userId: string,
  specialistType: string
): Promise<HerwaardeerdItem[]> {
  const { data: actieveItems, error } = await supabase
    .from('specialist_memory')
    .select('id, confidence, status, last_confirmed_at')
    .eq('user_id', userId)
    .eq('specialist_type', specialistType)
    .eq('status', 'active')

  if (error) throw error
  if (!actieveItems || actieveItems.length === 0) return []

  const resultaten: HerwaardeerdItem[] = []

  for (const item of actieveItems) {
    const nieuweConfidence = berekenGedecayedeConfidence(item.confidence, item.last_confirmed_at)
    const nieuweStatus = nieuweConfidence < CONFIDENCE_ONDERGRENS_DEPRECATED ? 'deprecated' : 'active'
    const gewijzigd = nieuweConfidence !== item.confidence || nieuweStatus !== item.status

    if (gewijzigd) {
      await supabase
        .from('specialist_memory')
        .update({ confidence: nieuweConfidence, status: nieuweStatus })
        .eq('id', item.id)
    }

    resultaten.push({
      id: item.id,
      oude_confidence: item.confidence,
      nieuwe_confidence: nieuweConfidence,
      oude_status: item.status,
      nieuwe_status: nieuweStatus,
      gewijzigd,
    })
  }

  return resultaten
}
