// ── Performance Intelligence Platform — kerncontract ────────────────────
// Bron: overleg 21 juli 2026. PerformanceContext is de ENIGE vorm waarin
// data bij een engine terechtkomt — nooit rechtstreekse Supabase-
// toegang vanuit een engine. Rijke context i.p.v. losse getRecoveryData()/
// getLoadData()-functies (op verzoek) — elke engine pakt zelf wat het
// nodig heeft uit dit object.

import type { DailyCheckin, HealthMetrics } from '@/types'
import type { PerformanceVoorRecovery } from '@/lib/specialists/health-analysis-engine'

export interface PerformanceContext {
  userId: string
  now: string // ISO-datum (yyyy-mm-dd), niet een Date-object — consistent met isoDatum() elders

  activities: {
    total: number
    last30Days: number
  }

  health: {
    hrvAvailable: boolean
    sleepAvailable: boolean
    bodyBatteryAvailable: boolean
    restingHrAvailable: boolean
  }

  sensors: {
    garmin: boolean
    // Strava-koppeling bestaat nog niet actief (zie README: "Strava
    // API-toegang — externe beleidswijziging") — altijd false voorlopig,
    // veld staat wel al klaar
    strava: boolean
  }

  history: {
    firstActivityDate: string | null
    daysTracked: number
  }

  // Ruwe data van vandaag — engines die een concrete berekening doen
  // (zoals Recovery) pakken dit rechtstreeks, i.p.v. zelf te fetchen.
  // Dit is de ENIGE plek in de hele Performance-laag die Supabase
  // aanraakt (performance-data-adapter.ts).
  raw: {
    checkin: DailyCheckin | null
    healthMetrics: HealthMetrics | null
    performanceSnapshot: PerformanceVoorRecovery | null
    // v2.4.149: bewust 0 in Fase 1A — de bestaande levensgebeurtenis-
    // penalty-berekening (zie api/status/route.ts) is nog niet
    // overgenomen in de adapter. De Recovery-wrapper hieronder geeft
    // daardoor bij een actieve levensgebeurtenis een net iets ander
    // (hoger) resultaat dan de live Coach Score op Home tot dit is
    // toegevoegd — expliciet benoemd, geen verborgen afwijking.
    lifeEventPenalty: number
  }
}
