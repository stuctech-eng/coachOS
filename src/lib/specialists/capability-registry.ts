// ── Capability Registry ─────────────────────────────────────────────────
// Bron: docs/specialist-engine-architecture.md, "Capability Registry".
// Voorkomt if-specialist-constructies in de UI — de Hub vraagt simpelweg
// "ondersteunt deze specialist periodisering?" i.p.v. sport-specifieke
// logica in de component zelf.
//
// BELANGRIJK, bewust eerlijk: dit is GEEN aspiratieve lijst van wat een
// specialist ooit zou moeten kunnen — het weerspiegelt exact wat er op
// dit moment daadwerkelijk gebouwd en getest is. Cycling heeft alleen
// stap 1-4 van de referentie-implementatie (Registry, Data Layer,
// Analysis Engine, Coach Layer) — geen Periodisering, Wedstrijden,
// Predictions of Benchmarks. Die staan dus terecht op `false`, niet
// omdat ze principieel onmogelijk zijn, maar omdat ze nog niet bestaan.

export interface SpecialistCapabilities {
  // Wat daadwerkelijk gebouwd is (referentie-implementatie-stappen 1-4)
  hasDataLayer: boolean
  hasAnalysisEngine: boolean
  hasCoachLayer: boolean
  // Toekomstige modules (specialist-coaches.md §6, specialist-api.md §9) —
  // nog niet geïmplementeerd voor geen enkele specialist op dit moment
  supportsPeriodization: boolean
  supportsEvents: boolean
  supportsPredictions: boolean
  supportsBenchmarks: boolean
}

export const CAPABILITY_REGISTRY: Record<string, SpecialistCapabilities> = {
  cycling: {
    hasDataLayer: true,
    hasAnalysisEngine: true,
    hasCoachLayer: true,
    supportsPeriodization: false,
    supportsEvents: false,
    supportsPredictions: false,
    supportsBenchmarks: false,
  },
  // v2.4.83: running toegevoegd — tweede specialist, exact dezelfde
  // capability-set als cycling op dit moment (stappen 1-4, geen
  // Periodisering/Events/Predictions/Benchmarks)
  running: {
    hasDataLayer: true,
    hasAnalysisEngine: true,
    hasCoachLayer: true,
    supportsPeriodization: false,
    supportsEvents: false,
    supportsPredictions: false,
    supportsBenchmarks: false,
  },
  // rowing/strength: nog geen enkele laag gebouwd (status 'development'
  // in de Specialist Registry, zie api/specialists/route.ts) — bewust
  // geen entry hier totdat er daadwerkelijk iets bestaat om te
  // registreren.
  // v2.4.349 (Kettlebell Specialist, Fase 0 + MVP1): Data Engine +
  // Analysis Engine gebouwd (kettlebell-data.ts/kettlebell-analysis.ts).
  // hasCoachLayer bewust false — er is nog geen AI-coachlaag voor
  // kettlebell (die komt pas met de Federatie Engine in MVP2, zodat de
  // coach-uitleg zich kan baseren op een echte regelset i.p.v. niets).
  kettlebell: {
    hasDataLayer: true,
    hasAnalysisEngine: true,
    hasCoachLayer: false,
    supportsPeriodization: false,
    supportsEvents: false,
    supportsPredictions: false,
    supportsBenchmarks: false,
  },
}

export function getCapabilities(specialistType: string): SpecialistCapabilities | null {
  return CAPABILITY_REGISTRY[specialistType] || null
}
