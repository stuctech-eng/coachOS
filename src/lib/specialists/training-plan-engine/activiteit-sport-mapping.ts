// ── Activiteitnaam → Sport-sleutel ────────────────────────────────────────
// Eén bron van waarheid voor "welke Nederlandse activiteit-weergavenaam
// hoort bij welke sport-sleutel (zoals gebruikt in matcher-registry.ts /
// training_plans.sport)". Voorheen lokaal gedefinieerd in
// strava-activity-processor.ts (ACTIVITEIT_NAAR_SPORT_SLEUTEL) — met
// Garmin TCX als tweede plek die dit nodig heeft (v2.4.276), nu hier
// gecentraliseerd i.p.v. een tweede, licht-afwijkende kopie.
//
// Bewust een unie van beide bron-vocabulaires: Strava's SPORT_TYPE_MAP
// geeft de generieke 'Fietsen', TCX's ACTIVITEIT_OPTIES onderscheidt al
// 'Fietsen (buiten)' / 'Indoor Fietsen' — allebei moeten naar dezelfde
// 'cycling'-sleutel wijzen, ongeacht welke importroute de naam
// aanleverde. Precies het Source Isolation-principe (ADR §2b): deze
// vertaling zit bewust nog IN de importlaag (elke route weet zijn eigen
// weergavenaam), maar levert een brononafhankelijke sleutel op zodra
// die de Matching Service ingaat.
export const ACTIVITEIT_NAAM_NAAR_SPORT_SLEUTEL: Record<string, string> = {
  Hardlopen: 'running',
  Fietsen: 'cycling',
  'Fietsen (buiten)': 'cycling',
  'Indoor Fietsen': 'cycling',
  Roeien: 'rowing',
}
