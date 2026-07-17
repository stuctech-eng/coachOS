import { createAdminClient } from '@/lib/supabase'
import { berekenNieuweConfidenceBijBevestiging, herwaardeerMemory } from './confidence-engine'

// ── Learning Engine ──────────────────────────────────────────────────────
// Bron: docs/specialist-memory.md, "Learning Engine — de kern van dit
// ontwerp". VOLLEDIG DETERMINISTISCH — geen AI, geen berekening door een
// taalmodel. De AI (Coach Layer) mag kandidaat-inzichten VOORSTELLEN,
// maar deze Engine beslist of iets gepromoveerd wordt naar een blijvend
// Memory-item.
//
// Matching-strategie, bewust eenvoudig en transparant: een kandidaat
// wordt beschouwd als bevestiging van een bestaand item als
// user_id + specialist_type + category overeenkomen (en het bestaande
// item niet deprecated is). Geen fuzzy tekst-matching op het
// inzicht zelf — dat zou niet-deterministisch worden. Beperking,
// eerlijk benoemd: twee werkelijk verschillende inzichten binnen
// dezelfde category worden hierdoor als hetzelfde behandeld (de nieuwste
// formulering overschrijft de oudere). Voor de huidige categorieën
// (training_response, preference, risk_pattern) is dit een redelijk
// startpunt — categorieën zijn bewust grof, niet per-inzicht uniek.

export type KnowledgeType = 'hard' | 'soft'

export interface KandidaatInzicht {
  specialist_type: string
  knowledge_type: KnowledgeType
  insight: string
  category: string
}

export interface LearningResultaat {
  actie: 'nieuw' | 'bevestigd'
  status: 'candidate' | 'active' | 'deprecated'
  confirmation_count: number
  item_id: string
}

// Aantal bevestigingen nodig vóór candidate → active promotie
const PROMOTIE_DREMPEL = 3

// Hard knowledge (FTP, max hartslag, PR's) heeft geen meermaals-
// bevestiging nodig — één geldige observatie volstaat, zoals vastgelegd
// in specialist-memory.md ("Hard Knowledge ontstaat sneller")
const HARD_KNOWLEDGE_INITIELE_CONFIDENCE = 100
const SOFT_KNOWLEDGE_INITIELE_CONFIDENCE = 20

export async function verwerkKandidaatInzicht(userId: string, kandidaat: KandidaatInzicht): Promise<LearningResultaat> {
  const supabase = createAdminClient()

  const { data: bestaand } = await supabase
    .from('specialist_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('specialist_type', kandidaat.specialist_type)
    .eq('category', kandidaat.category)
    .neq('status', 'deprecated')
    .order('last_confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (bestaand) {
    // ── Bevestiging van een bestaand inzicht ──────────────────────────
    const nieuweCount = bestaand.confirmation_count + 1
    const wordtGepromoveerd = bestaand.status === 'candidate' && nieuweCount >= PROMOTIE_DREMPEL
    const nieuweStatus = wordtGepromoveerd ? 'active' : bestaand.status
    // v2.4.76: confidence stijgt bij elke bevestiging, ongeacht of
    // dit ook een promotie-moment is — bevestiging is altijd een
    // positief signaal (Confidence Engine, deterministisch)
    const nieuweConfidence = berekenNieuweConfidenceBijBevestiging(bestaand.confidence)

    const { data: bijgewerkt, error } = await supabase
      .from('specialist_memory')
      .update({
        insight: kandidaat.insight, // meest recente formulering van de AI
        confirmation_count: nieuweCount,
        last_confirmed_at: new Date().toISOString(),
        status: nieuweStatus,
        confidence: nieuweConfidence,
      })
      .eq('id', bestaand.id)
      .select()
      .single()

    if (error) throw error

    return {
      actie: 'bevestigd',
      status: bijgewerkt.status,
      confirmation_count: bijgewerkt.confirmation_count,
      item_id: bijgewerkt.id,
    }
  } else {
    // ── Nieuw kandidaat-inzicht ────────────────────────────────────────
    const initieleStatus = kandidaat.knowledge_type === 'hard' ? 'active' : 'candidate'
    const initieleConfidence = kandidaat.knowledge_type === 'hard'
      ? HARD_KNOWLEDGE_INITIELE_CONFIDENCE
      : SOFT_KNOWLEDGE_INITIELE_CONFIDENCE

    const { data: nieuw, error } = await supabase
      .from('specialist_memory')
      .insert({
        user_id: userId,
        specialist_type: kandidaat.specialist_type,
        knowledge_type: kandidaat.knowledge_type,
        insight: kandidaat.insight,
        category: kandidaat.category,
        confidence: initieleConfidence,
        status: initieleStatus,
        confirmation_count: 1,
      })
      .select()
      .single()

    if (error) throw error

    return {
      actie: 'nieuw',
      status: nieuw.status,
      confirmation_count: nieuw.confirmation_count,
      item_id: nieuw.id,
    }
  }
}

export async function haalMemoryOp(userId: string, specialistType: string, alleenActief = false) {
  const supabase = createAdminClient()

  // v2.4.76: decay lazy toepassen vóór het lezen — geen achtergrond-
  // cronjob nodig, confidence is alleen relevant op het moment dat
  // Memory daadwerkelijk gelezen wordt (bijv. door de Coach Layer)
  await herwaardeerMemory(supabase, userId, specialistType)

  let query = supabase
    .from('specialist_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('specialist_type', specialistType)
    .order('confidence', { ascending: false })

  if (alleenActief) query = query.eq('status', 'active')

  const { data, error } = await query
  if (error) throw error
  return data || []
}
