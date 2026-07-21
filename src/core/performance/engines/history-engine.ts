import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '../shared/dates'

// ── History Engine ────────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 1B, laatste stap. "Bewaart niet
// alleen de actuele score, maar ook de volledige geschiedenis."
//
// Bewuste uitzondering op "engines raken de database niet aan": het
// BEWAREN van scores is letterlijk de kernfunctie van deze engine, dus
// hier hoort databasetoegang thuis (net als de data-adapter). Andere
// engines blijven puur rekenwerk.
//
// v2.4.155-les toegepast: GEEN upsert-met-onConflict (zie v2.4.145 —
// dat faalde stil op health_metrics door een niet-matchende
// database-sleutel). Expliciet update-of-insert, kan niet stil
// mislukken op een sleutel-mismatch.

export interface HistoriePunt {
  date: string
  score: number
}

export async function bewaarSnapshot(userId: string, engine: string, score: number, payload?: unknown): Promise<void> {
  const supabase = createAdminClient()
  const vandaag = isoDatum(new Date())

  const { data: bestaand } = await supabase
    .from('performance_engine_history')
    .select('id')
    .eq('user_id', userId).eq('date', vandaag).eq('engine', engine)
    .maybeSingle()

  if (bestaand?.id) {
    const { error } = await supabase
      .from('performance_engine_history')
      .update({ score, payload: payload ?? null })
      .eq('id', bestaand.id)
    if (error) console.error(`[history-engine] UPDATE mislukt voor ${engine}:`, error)
  } else {
    const { error } = await supabase
      .from('performance_engine_history')
      .insert({ user_id: userId, date: vandaag, engine, score, payload: payload ?? null })
    if (error) console.error(`[history-engine] INSERT mislukt voor ${engine}:`, error)
  }
}

export async function haalHistorie(userId: string, engine: string, aantalDagen: number): Promise<HistoriePunt[]> {
  const supabase = createAdminClient()
  const vanaf = new Date()
  vanaf.setDate(vanaf.getDate() - aantalDagen)

  const { data } = await supabase
    .from('performance_engine_history')
    .select('date, score')
    .eq('user_id', userId).eq('engine', engine)
    .gte('date', isoDatum(vanaf))
    .order('date', { ascending: true })

  return data || []
}
