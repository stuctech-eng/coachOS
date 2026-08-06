import type { SupabaseClient } from '@supabase/supabase-js'
import { haalOverzichtData } from '@/lib/coach-planning-overzicht'

// ── Coach Inbox — Fase C, eerste signaal ─────────────────────────────────
// Bron: README, Coach Agenda-visie Fase C ("Coach Inbox — proactieve
// meldingen op Home"), letterlijk voorbeeld daar al genoemd: "Volgende
// week begint je vakantie — trainingsplan pauzeren?" Nu voor het eerst
// gebouwd, bewust met precies dit ene signaal — niet de volledige
// patroonherkenning-visie (die blijft Fase C, later).
//
// Architectuurregel #0 gevolgd: `haalOverzichtData()` (bestaat al,
// gedeeld met Coach Planning) hergebruikt voor de vakantie-data — geen
// nieuwe query op `life_events` verzonnen.

export interface CoachInboxSignaal {
  type: 'vakantie_pauze_voorstel'
  titel: string
  tekst: string
  sporten: string[] // sport-sleutels van de actieve plannen die dit zou raken
}

const VOORUIT_VENSTER_DAGEN = 7

export async function evalueerCoachInboxSignalen(
  supabase: SupabaseClient,
  userId: string,
): Promise<CoachInboxSignaal[]> {
  const signalen: CoachInboxSignaal[] = []

  const overzicht = await haalOverzichtData(supabase, userId)
  if (overzicht.volgendeVakantie) {
    const vandaag = new Date().toISOString().split('T')[0]
    const dagenTot = Math.round(
      (new Date(overzicht.volgendeVakantie.datum + 'T00:00:00').getTime() - new Date(vandaag + 'T00:00:00').getTime())
      / (1000 * 60 * 60 * 24)
    )

    // Alleen een vooruitblik (nog niet begonnen) binnen het venster —
    // een AL lopende vakantie hoeft niet meer "voorgesteld" te worden,
    // dat is een ander moment (zie ook de "Nu bezig"-fix, v2.4.297, die
    // precies dit onderscheid al maakte voor de Vooruitblik-kaart).
    if (dagenTot >= 0 && dagenTot <= VOORUIT_VENSTER_DAGEN) {
      const { data: actievePlannen } = await supabase
        .from('training_plans').select('id, sport')
        .eq('athlete_id', userId).eq('status', 'active')

      if (actievePlannen && actievePlannen.length > 0) {
        const wanneer = dagenTot === 0 ? 'vandaag' : dagenTot === 1 ? 'morgen' : `over ${dagenTot} dagen`
        signalen.push({
          type: 'vakantie_pauze_voorstel',
          titel: 'Vakantie in aantocht',
          tekst: `Je vakantie begint ${wanneer}. Trainingsplan${actievePlannen.length > 1 ? 'nen' : ''} pauzeren tot je terug bent?`,
          sporten: actievePlannen.map(p => p.sport),
        })
      }
    }
  }

  return signalen
}

/** Pauzeert voor alle opgegeven sporten het actieve trainingsplan —
 * zelfde database-mutatie als de bestaande PATCH-routes per specialist
 * (rowing/running/cycling/training-plan/route.ts), hier direct
 * uitgevoerd i.p.v. een interne HTTP-aanroep naar die routes (voorkomt
 * een request-context-afhankelijkheid voor iets dat net zo goed een
 * rechtstreekse database-update is). */
export async function pauzeerTrainingsplannen(
  supabase: SupabaseClient,
  userId: string,
  sporten: string[],
): Promise<number> {
  const { data, error } = await supabase
    .from('training_plans')
    .update({ status: 'paused' })
    .eq('athlete_id', userId).in('sport', sporten).eq('status', 'active')
    .select('id')
  if (error) {
    console.error('[coach-inbox] Pauzeren mislukt:', error)
    return 0
  }
  return data?.length || 0
}
