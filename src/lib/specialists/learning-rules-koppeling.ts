import { createAdminClient } from '@/lib/supabase'
import { evalueerRegels } from '@/core/athlete-platform/learning-rules-engine'
import { haalLearningContext } from './learning-context'

// ── Learning Rules Engine — daadwerkelijke koppeling ─────────────────────
// Bron: overleg 3 augustus 2026. Dit is de ontbrekende schakel die de
// Learning Rules Engine (v2.4.236) voor het eerst echt laat draaien.
//
// SCOPE, EERLIJK BEGRENSD: deze functie evalueert regels en SLAAT
// NIEUWE BEVINDINGEN OP (zichtbaar op /athlete-platform, matcht de
// "eerst zichtbaar maken"-aanpak die ook bij kruis-sport-aanpassingen
// werkte). Wat deze functie NIET doet: de gevonden regel automatisch
// laten meewegen in toekomstige Impact Engine-berekeningen — dat is
// een bewust aparte, latere stap (vergt een uitbreiding van
// combineerWaarde() om geleerde aanpassingen mee te nemen), niet in
// deze levering meegenomen om het niet te overhaasten.

export async function evalueerEnBewaarLeerpatronenIndienNodig(userId: string, sport: string): Promise<void> {
  try {
    const context = await haalLearningContext(userId, sport)
    const uitkomst = evalueerRegels(context)

    if (uitkomst.personalisatieStatus === 'population_model') return // te weinig data, niets te leren

    const supabase = createAdminClient()
    for (const resultaat of uitkomst.resultaten) {
      if (!resultaat.gevuurd) continue
      // upsert met de unique-constraint (user_id, sport, rule_id) —
      // idempotent, een al-ontdekt patroon wordt niet opnieuw als
      // "nieuw" opgeslagen, alleen de eerste keer dat het vuurt telt
      await supabase.from('learned_patterns').upsert({
        user_id: userId, sport, rule_id: resultaat.regel.id,
        rule_naam: resultaat.regel.naam, beschrijving: resultaat.regel.beschrijving,
        effect_pad: resultaat.regel.effect.pad, aanpassing_percentage: resultaat.regel.effect.aanpassingPercentage,
      }, { onConflict: 'user_id,sport,rule_id', ignoreDuplicates: true })
    }
  } catch (err) {
    // Mag de aanroeper (een sync-route) nooit laten falen
    console.error('[learning-context] Evalueren/opslaan leerpatronen mislukt:', err)
  }
}
