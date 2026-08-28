import { createAdminClient } from '@/lib/supabase'
import { nieuweBronWint } from './source-priority-policy'

// ── Connect Result Bridge ────────────────────────────────────────────────
// Bron: CoachOS Connect-contractreview + architectuurbeslissing (28
// augustus 2026): Swift Connect blijft de enige PM5/CSAFE-runtime, en
// resultaten landen in het BESTAANDE activity_sessions + Source Priority
// Policy-systeem — geen nieuw, apart resultaat-systeem. Dit bestand volgt
// exact hetzelfde patroon als activity-bridge.ts (Trainer AI) en
// concept2-result-processor.ts (Concept2-cloud-import): idempotency via
// een `notes`-marker, Source Priority-check tegen bestaande rijen van
// die dag, dan pas insert.
//
// EERLIJKE BEPERKING (net als bij de Trainer AI-brug): CoachOS Connect
// levert vandaag nog GEEN live PM5-metrics (Sprint 8 van de Connect-
// roadmap moet dat nog decoderen — PM5Adapter.metricsStream() geeft nu
// een lege stream terug). De payload die deze route accepteert is al wel
// het volledige, toekomstbestendige schema; totdat Sprint 8 klaar is,
// zal Connect in de praktijk alleen `startedAt`/`completedAt` en de
// workout-referentie meesturen, met een grotendeels lege `metrics`.

export interface ConnectWorkoutResultInterval {
  index: number
  distance_m?: number
  duration_sec?: number
  avg_pace_sec_per_500m?: number
  avg_watts?: number
  avg_stroke_rate?: number
}

export interface ConnectWorkoutResultInput {
  userId: string
  sessieId: string
  startedAt: string // ISO 8601
  completedAt: string // ISO 8601
  device: { manufacturer: string; model: string }
  totals?: {
    distance_m?: number
    avg_watts?: number
    avg_stroke_rate?: number
    avg_heart_rate?: number
  }
  intervals?: ConnectWorkoutResultInterval[]
}

export interface ConnectResultBridgeUitkomst {
  aangemaakt: boolean
  reden: string
  activiteitId?: string
}

const CONNECT_BRON = 'coachos_connect'
const ACTIVITEIT_NAAM = 'Roeien'

export async function verwerkConnectWorkoutResultaat(
  input: ConnectWorkoutResultInput,
): Promise<ConnectResultBridgeUitkomst> {
  const supabase = createAdminClient()

  // Idempotency — zelfde patroon als activity-bridge.ts/concept2-result-
  // processor.ts: een marker in `notes`, gescopet op user+source, zodat
  // een dubbele/herhaalde upload (bijv. vanuit Connect's offline-wachtrij
  // na een mislukte eerdere poging) nooit een tweede rij oplevert.
  const { data: bestaandeRij } = await supabase
    .from('activity_sessions')
    .select('id')
    .eq('user_id', input.userId)
    .eq('source', CONNECT_BRON)
    .ilike('notes', `%coachos_connect:${input.sessieId}%`)
    .maybeSingle()
  if (bestaandeRij) {
    return { aangemaakt: false, reden: 'al eerder geüpload voor deze sessie', activiteitId: bestaandeRij.id }
  }

  let { data: userActivity } = await supabase
    .from('activities').select('id')
    .eq('user_id', input.userId).eq('name', ACTIVITEIT_NAAM).maybeSingle()
  if (!userActivity) {
    const { data: template } = await supabase
      .from('activity_templates').select('id').eq('name', ACTIVITEIT_NAAM).maybeSingle()
    const { data: newActivity } = await supabase
      .from('activities').insert({ user_id: input.userId, template_id: template?.id || null, name: ACTIVITEIT_NAAM })
      .select().single()
    userActivity = newActivity
  }

  const dagStr = input.startedAt.split('T')[0]

  // Source Priority Policy — zelfde generieke dedup als elke andere bron.
  // coachos_connect (110) staat boven concept2 (100): een directe
  // PM5-meting via Connect wint van een latere Concept2-cloud-sync van
  // dezelfde training, niet andersom.
  const { data: bestaandeDieDag } = await supabase
    .from('activity_sessions')
    .select('id, source')
    .eq('user_id', input.userId)
    .eq('date', dagStr)
    .eq('activity_id', userActivity?.id || null)

  const geblokkeerdDoor = (bestaandeDieDag || []).find(rij => !nieuweBronWint(CONNECT_BRON, rij.source))
  if (geblokkeerdDoor) {
    return { aangemaakt: false, reden: `bestaande activiteit met hogere source-prioriteit ('${geblokkeerdDoor.source}') wint` }
  }

  const startedAtMs = new Date(input.startedAt).getTime()
  const completedAtMs = new Date(input.completedAt).getTime()
  const duurSeconden = Math.max(0, Math.round((completedAtMs - startedAtMs) / 1000))
  const duurMinuten = Math.round(duurSeconden / 60)

  // Zelfde vorm als concept2-result-processor.ts: platte Record met
  // snake_case-sleutels, alleen aanwezige waarden toegevoegd (geen
  // schijndata/nullen voor wat Connect nog niet levert).
  const metrics: Record<string, unknown> = {
    precieze_duur_sec: duurSeconden,
    device: `${input.device.manufacturer} ${input.device.model}`,
  }
  if (input.totals?.distance_m !== undefined) metrics.distance = input.totals.distance_m
  if (input.totals?.avg_watts !== undefined) metrics.avg_watts = input.totals.avg_watts
  if (input.totals?.avg_stroke_rate !== undefined) metrics.avg_stroke_rate = input.totals.avg_stroke_rate
  if (input.totals?.avg_heart_rate !== undefined) metrics.avg_hr = input.totals.avg_heart_rate
  if (input.intervals && input.intervals.length > 0) metrics.intervallen = input.intervals

  const { data: nieuweActiviteit, error } = await supabase
    .from('activity_sessions')
    .insert({
      user_id: input.userId,
      activity_id: userActivity?.id || null,
      date: dagStr,
      duration: duurMinuten,
      metrics,
      source: CONNECT_BRON,
      notes: `coachos_connect:${input.sessieId}`,
    })
    .select('id').single()

  if (error) {
    console.error('[connect-result-bridge] Insert mislukt:', error)
    return { aangemaakt: false, reden: `insert mislukt: ${error.message}` }
  }

  return { aangemaakt: true, reden: 'activity_session aangemaakt vanuit CoachOS Connect', activiteitId: nieuweActiviteit?.id }
}
