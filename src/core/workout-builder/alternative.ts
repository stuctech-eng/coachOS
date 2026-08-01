// ── CoachOS Workout Platform — Alternative Engine ────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0. Fase 1, stap 5c.
// "Iedere workout krijgt alternatieven" — bijv. fietsen→roeien bij slecht
// weer, of een indoor-alternatief. Bewust GEEN hardcoded sport-mapping
// hier (dat zou sportlogica in de Core zijn, in strijd met de Kernregel)
// — de aanroeper levert de mogelijke alternatieven aan, deze Engine kiest
// er alleen uit op basis van de gegeven reden(en).

export interface AlternatiefOptie {
  reden: 'materiaal_ontbreekt' | 'slecht_weer' | 'blessure' | 'locatie_onbeschikbaar'
  workout_id: string
  omschrijving: string
}

export interface AlternativeContext {
  materiaalOntbreekt?: boolean
  slechtWeer?: boolean
  locatieOnbeschikbaar?: boolean
}

/** Kiest, uit een door de aanroeper aangeleverde lijst mogelijke
 * alternatieven, welke daadwerkelijk relevant zijn gegeven de huidige
 * context. Puur filteren/matchen — geen eigen kennis over WELKE
 * alternatieven er zijn (dat levert de Specialist Adapter aan). */
export function bepaalAlternatieven(mogelijkeAlternatieven: AlternatiefOptie[], context: AlternativeContext): { reden: string; workout_id: string }[] {
  const relevant: AlternatiefOptie[] = []

  if (context.materiaalOntbreekt) relevant.push(...mogelijkeAlternatieven.filter(a => a.reden === 'materiaal_ontbreekt'))
  if (context.slechtWeer) relevant.push(...mogelijkeAlternatieven.filter(a => a.reden === 'slecht_weer'))
  if (context.locatieOnbeschikbaar) relevant.push(...mogelijkeAlternatieven.filter(a => a.reden === 'locatie_onbeschikbaar'))

  // Dedupliceren op workout_id — als hetzelfde alternatief om meerdere
  // redenen relevant is, wordt het maar één keer getoond
  const gezien = new Set<string>()
  const uniek = relevant.filter(a => {
    if (gezien.has(a.workout_id)) return false
    gezien.add(a.workout_id)
    return true
  })

  return uniek.map(a => ({ reden: a.omschrijving, workout_id: a.workout_id }))
}
