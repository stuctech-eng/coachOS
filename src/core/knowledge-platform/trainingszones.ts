// ── CoachOS Knowledge Platform — Training Science: Trainingszones ───────
// Bron: Universal Athlete Platform Master Architecture, 2 augustus 2026
// ("Knowledge Platform = bron van waarheid, niet een stap in een
// proces" — geraadpleegd door Workout Platform/Learning Rules Engine/
// Specialisten, zelf nooit een beslissende laag).
//
// Eerste, concrete kennis-categorie: het standaard 5-zone-trainings-
// model (%HFmax-gebaseerd), breed gebruikt in duursporten. Dit was tot
// nu toe hardcoded als losse tekst-strings in workout-builder/
// builder.ts — nu één bron van waarheid, met expliciete herkomst
// i.p.v. verzonnen tekst zonder onderbouwing.
//
// EERLIJK: dit is het algemeen aanvaarde, generieke 5-zone-model — geen
// gepersonaliseerde, sporter-specifieke zones (die vergen een eigen
// FTP/HFmax-meting, bewust nog niet gebouwd, zie Rowing Profiel-
// instellingen). Zodra zo'n persoonlijke baseline bestaat, kan deze
// kennis-laag de generieke percentages vertalen naar concrete waarden.

export interface TrainingszoneKennis {
  zone_nummer: number
  naam: string
  percentage_hfmax: { van: number; tot: number }
  rpe_equivalent: { van: number; tot: number } // Rate of Perceived Exertion, schaal 1-10
  doel: string
  instructie: string
}

export const TRAININGSZONES: TrainingszoneKennis[] = [
  {
    zone_nummer: 1, naam: 'Herstel', percentage_hfmax: { van: 50, tot: 60 }, rpe_equivalent: { van: 1, tot: 2 },
    doel: 'Actief herstel, bloedcirculatie bevorderen zonder extra belasting toe te voegen.',
    instructie: 'Zeer rustig, gesprekstempo — dit is actief herstel, geen training.',
  },
  {
    zone_nummer: 2, naam: 'Basis-uithoudingsvermogen', percentage_hfmax: { van: 60, tot: 70 }, rpe_equivalent: { van: 3, tot: 4 },
    doel: 'Aerobe basis opbouwen, vetverbranding als primaire energiebron trainen.',
    instructie: 'Gelijkmatig, aeroob tempo — rustig ademen tijdens het praten.',
  },
  {
    zone_nummer: 3, naam: 'Tempo', percentage_hfmax: { van: 70, tot: 80 }, rpe_equivalent: { van: 5, tot: 6 },
    doel: 'Aerobe capaciteit verhogen, comfortabel-oncomfortabel tempo trainen.',
    instructie: 'Comfortabel-oncomfortabel tempo, vol te houden voor de hele duur.',
  },
  {
    zone_nummer: 4, naam: 'Drempel', percentage_hfmax: { van: 80, tot: 90 }, rpe_equivalent: { van: 7, tot: 8 },
    doel: 'Lactaatdrempel verhogen — hoe lang kun je een stevig tempo volhouden.',
    instructie: 'Stevig tempo, gecontroleerd — niet forceren in de eerste herhalingen.',
  },
  {
    zone_nummer: 5, naam: 'Maximaal/VO2max', percentage_hfmax: { van: 90, tot: 100 }, rpe_equivalent: { van: 9, tot: 10 },
    doel: 'Maximale zuurstofopname trainen, korte, intensieve inspanningen.',
    instructie: 'Maximale inspanning per herhaling, volledig herstel tussendoor.',
  },
]

export function haalTrainingszone(zoneNummer: number): TrainingszoneKennis | null {
  return TRAININGSZONES.find(z => z.zone_nummer === zoneNummer) || null
}
