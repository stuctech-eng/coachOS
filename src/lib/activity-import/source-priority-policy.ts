// ── Source Priority Policy ────────────────────────────────────────────────
// Bron: overleg 5 augustus 2026, onderdeel van de Activity Import-laag
// (Source Isolation-principe, ADR §2b). Vervangt losse if/else-dedup-
// regels (zoals de bestaande Concept2-vs-Strava-check bij Rowing) door
// één centrale, uitbreidbare prioriteitstabel — zelfde patroon als de
// Sport Adapters (Training Plan Engine) en de Sport Matchers (Workout
// Matching Service): generieke Core, geen sportspecifieke/
// bronspecifieke if/else's verspreid door de codebase.
//
// Bewust NIET met terugwerkende kracht toegepast op de bestaande
// dedup-checks in concept2/sync/route.ts, garmin-activity-tcx/route.ts
// en strava-activity-processor.ts — die werken al correct. Dit is voor
// nieuwe/toekomstige dedup-beslissingen (te beginnen met de Activity
// Bridge hieronder). Migreren van de bestaande checks naar deze policy
// is een aparte, latere consolidatie, geen vereiste voor deze levering.
//
// Waarom dit uitbreidbaar is zonder herontwerp: een toekomstige bron
// (Polar/COROS/Zwift/Wahoo/etc.) voegt alleen een regel toe aan deze
// tabel — geen enkele aanroeper hoeft te wijzigen.
//
// ⚠️ LET OP, geleerd via v2.4.280 (activity_sessions_source_check gaf
// een insert-fout bij 'trainer_ai', pas ontdekt via het debug-scherm):
// een regel HIER toevoegen is NIET voldoende om een nieuwe bron
// daadwerkelijk te kunnen opslaan. `activity_sessions.source` heeft
// een aparte database check-constraint (`activity_sessions_source_check`)
// die los bijgewerkt moet worden — deze policy en die constraint zijn
// twee verschillende plekken die met opzet SAMEN bijgewerkt moeten
// worden. Vóór het toevoegen van een nieuwe bron: eerst
// `select pg_get_constraintdef(oid) from pg_constraint where conname =
// 'activity_sessions_source_check'` om de huidige toegestane waarden te
// bevestigen, dan de SQL-migratie klaarzetten, dan pas de code.

export const SOURCE_PRIORITEIT: Record<string, number> = {
  concept2: 100,
  garmin: 90,
  strava: 80,
  apple_health: 70,
  trainer_ai: 10,
  manual: 0,
}

/** Onbekende bronnen krijgen de laagste prioriteit (0) — nooit een
 * bestaande, bekende bron overschrijven met iets dat we niet herkennen. */
export function prioriteitVoorBron(source: string): number {
  return SOURCE_PRIORITEIT[source] ?? 0
}

/** True als `nieuweBron` een bestaande activiteit met `bestaandeBron`
 * MAG vervangen/overslaan-voorkomen — d.w.z. nieuweBron heeft een
 * gelijke of hogere prioriteit. Bij een STRIKT lagere prioriteit wint
 * de bestaande bron altijd (device wint van in-app, in-app wint nooit
 * van device). */
export function nieuweBronWint(nieuweBron: string, bestaandeBron: string): boolean {
  return prioriteitVoorBron(nieuweBron) >= prioriteitVoorBron(bestaandeBron)
}
