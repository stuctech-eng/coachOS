// ── Recovery Intelligence — configuratie ────────────────────────────────
// v2.4.328. Leest de actieve parameterset uit ri_algorithm_config_versions
// (Fase 8.1, punt 5 — versioned, nooit los-muteerbare key/value). Deze
// tabel heeft BEWUST geen RLS-policies (server-only), dus dit bestand
// mag uitsluitend server-side aangeroepen worden, nooit client-side.

import { SupabaseClient } from '@supabase/supabase-js'
import type { RiAlgorithmConfig } from './types'

interface ActiveConfigRow {
  version: string
  config: RiAlgorithmConfig
}

export async function haalActieveRiConfig(supabase: SupabaseClient): Promise<{ version: string; config: RiAlgorithmConfig } | null> {
  const { data, error } = await supabase
    .from('ri_algorithm_config_versions')
    .select('version, config')
    .eq('active', true)
    .maybeSingle()

  if (error || !data) {
    console.error('[recovery-intelligence] Actieve configuratie ophalen mislukt:', error)
    return null
  }

  const rij = data as ActiveConfigRow
  return { version: rij.version, config: rij.config }
}
