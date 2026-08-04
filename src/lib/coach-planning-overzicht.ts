import { SupabaseClient } from '@supabase/supabase-js'

// v2.4.202 (Smart Action Engine, Fase C): geëxtraheerd uit
// api/coach-planning/overzicht/route.ts (v2.4.200) zodat de Smart
// Action Engine dezelfde, al-geteste dataverzameling kan hergebruiken
// zonder een kwetsbare interne HTTP-self-call (zie v2.4.184 — dat
// patroon veroorzaakte eerder een echte bug via VERCEL_URL). Directe
// functie-aanroep i.p.v. fetch('/api/...') binnen de server.
//
// v2.4.203-FIX: new Date().toISOString().split('T')[0] geeft de datum
// in UTC, niet de lokale kalenderdag — kon rond middernacht lokale tijd
// een dag verkeerd rapporteren. Vervangen door lokaleDagStr().

function lokaleDagStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface LifeEventRij {
  type: string
  start_time: string
  end_date: string | null
  recurrence: string | null
  recurrence_days: number[] | null
  recurrence_end_date: string | null
  recurrence_exceptions: string[] | null
}

function weekVerschil(startDatumStr: string, dagStr: string): number {
  const maandagVan = (datumStr: string) => {
    const d = new Date(datumStr + 'T00:00:00')
    const dagOffset = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - dagOffset)
    return d
  }
  const verschilMs = maandagVan(dagStr).getTime() - maandagVan(startDatumStr).getTime()
  return Math.round(verschilMs / (1000 * 60 * 60 * 24 * 7))
}

// v2.4.203-FIX: was voorheen volledig afwezig in de werkdiensten-telling
// hieronder (die keek alleen naar !recurrence, dus eenmalige events) —
// werkroosters zijn vrijwel altijd terugkerend, dus de telling gaf
// stelselmatig 0 terug ("twee weken geen werkdiensten" ondanks een
// actief rooster). Zelfde logica als isHerhalendActiefOpDag/
// isEenmaligActiefVandaag in coach-planning/page.tsx — bewust hier
// gedupliceerd (server- vs. client-bestand), geen gedeelde module
// (zou een grotere refactor zijn, niet gecombineerd met deze bugfix-ronde).
function isEventActiefOpDag(e: LifeEventRij, dagStr: string): boolean {
  // v2.4.205-FIX: was e.start_time.split('T')[0] — ruwe string-
  // extractie inconsistent met lokaleDagStr() elders
  const startDatum = lokaleDagStr(new Date(e.start_time))
  if (!e.recurrence) {
    const eindDatum = e.end_date || startDatum
    return dagStr >= startDatum && dagStr <= eindDatum
  }
  if (e.recurrence_exceptions?.includes(dagStr)) return false
  if (dagStr < startDatum) return false
  if (e.end_date && dagStr > e.end_date) return false
  if (e.recurrence_end_date && dagStr > e.recurrence_end_date) return false

  const dagDatum = new Date(dagStr + 'T00:00:00')
  const dagNummer = dagDatum.getDay()
  const isWeekend = dagNummer === 0 || dagNummer === 6

  if (e.recurrence === 'workdays') return !isWeekend
  if (e.recurrence === 'weekend') return isWeekend
  if (e.recurrence === 'weekly' || e.recurrence === 'custom') {
    return e.recurrence_days ? e.recurrence_days.includes(dagNummer) : true
  }
  if (e.recurrence === 'biweekly') {
    const dagMatcht = e.recurrence_days ? e.recurrence_days.includes(dagNummer) : true
    return dagMatcht && weekVerschil(startDatum, dagStr) % 2 === 0
  }
  if (e.recurrence === 'yearly') return dagStr.slice(5) === startDatum.slice(5)
  if (e.recurrence === 'monthly') return dagStr.slice(8) === startDatum.slice(8)
  return true // daily
}

export interface OverzichtData {
  volgendeVakantie: { datum: string; eindDatum: string | null } | null
  volgendEvenement: { datum: string; type: string } | null
  huidigeFase: string | null
  volgendeFaseWissel: { datum: string; fase: string } | null
  werkEventsKomende14Dagen: number
  trainingenKomendeWeek: number
  // v2.4.211: Coach Vooruitblik toonde alleen vakantie/wedstrijd/fase —
  // gemeld dat het oorspronkelijke voorbeeld (Nachtdienst, Fysio) ook
  // werk en medische afspraken bevatte. Nu toegevoegd: eerstvolgende
  // van elk, binnen 14 dagen, dag-voor-dag gecheckt met dezelfde
  // isEventActiefOpDag() als de werkdiensten-telling hierboven.
  volgendeWerkdienst: { datum: string; type: string } | null
  volgendeMedischeAfspraak: { datum: string; type: string } | null
}

export async function haalOverzichtData(supabase: SupabaseClient, userId: string): Promise<OverzichtData> {
  const vandaag = lokaleDagStr(new Date())
  const over7Dagen = lokaleDagStr(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  const over90Dagen = lokaleDagStr(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))

  const { data: actievePlannen } = await supabase
    .from('training_plans').select('id').eq('athlete_id', userId).eq('status', 'active')
  const planIds = (actievePlannen || []).map(p => p.id)

  const [lifeEventsRes, sessiesRes] = await Promise.all([
    // v2.4.203-FIX: recurrence_days/recurrence_end_date/recurrence_exceptions
    // toegevoegd aan de select — ontbraken, nodig voor isEventActiefOpDag().
    // Ook: gte('start_time', ...) verwijderd voor recurrente events (een
    // regel die vóór vandaag begon, maar nog steeds doorloopt, zou anders
    // gemist worden) — apart opgehaald zonder datumfilter op start_time.
    // v2.4.263-FIX: gte('start_time', vandaag) verwijderd — zelfde
    // reden als bij herhalende events (v2.4.203): een eenmalig event
    // dat vóór vandaag begon maar nog doorloopt (bijv. een vakantie
    // van 20 juli t/m 9 augustus, vandaag ergens middenin) werd anders
    // gemist. Nu net als bij herhalende events: geen datumfilter op
    // start_time, alleen de 90-dagen-bovengrens blijft staan.
    supabase.from('life_events').select('type, start_time, end_date, recurrence, recurrence_days, recurrence_end_date, recurrence_exceptions')
      .eq('user_id', userId)
      .is('recurrence', null)
      .lte('start_time', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time'),
    planIds.length > 0
      ? supabase.from('training_plan_sessions').select('date, mesocycle_type, sport, type')
          .in('plan_id', planIds)
          .gte('date', vandaag)
          .lte('date', over90Dagen)
          .order('date')
      : Promise.resolve({ data: [] as { date: string; mesocycle_type: string | null; sport: string; type: string }[] }),
    ])

  // Terugkerende events apart ophalen — geen datumfilter op start_time,
  // want een regel die al maanden geleden begon telt nog steeds mee
  const { data: herhalendeEvents } = await supabase
    .from('life_events').select('type, start_time, end_date, recurrence, recurrence_days, recurrence_end_date, recurrence_exceptions')
    .eq('user_id', userId)
    .not('recurrence', 'is', null)

  const eenmaligeEvents = (lifeEventsRes.data || []) as LifeEventRij[]
  const alleHerhalendeEvents = (herhalendeEvents || []) as LifeEventRij[]
  const sessies = sessiesRes.data || []

  const volgendeVakantie = eenmaligeEvents.find(e => e.type === 'vakantie')
  const volgendEvenement = eenmaligeEvents.find(e => e.type === 'evenement' || e.type === 'testdag')

  const sessiesMetFase = sessies.filter(s => s.mesocycle_type)
  const huidigeFase = sessiesMetFase.find(s => s.date === vandaag)?.mesocycle_type || null
  const volgendeFaseWissel = sessiesMetFase.find(s => s.mesocycle_type !== huidigeFase && s.date > vandaag)

  // Werkdiensten komende 14 dagen — nu ELKE dag apart checken tegen
  // ZOWEL eenmalige als terugkerende werk-events, i.p.v. alleen
  // eenmalige events te tellen
  const WERK_TYPES = ['nachtdienst', 'avonddienst', 'vroege_dienst', 'dagdienst', 'lange_dag', 'consignatie']
  const werkEvents = [...eenmaligeEvents, ...alleHerhalendeEvents].filter(e => WERK_TYPES.includes(e.type))
  let werkEventsKomende14Dagen = 0
  let volgendeWerkdienst: { datum: string; type: string } | null = null
  for (let i = 0; i < 14; i++) {
    const dagStr = lokaleDagStr(new Date(Date.now() + i * 24 * 60 * 60 * 1000))
    const matchVandaag = werkEvents.find(e => isEventActiefOpDag(e, dagStr))
    if (matchVandaag) {
      werkEventsKomende14Dagen++
      if (!volgendeWerkdienst) volgendeWerkdienst = { datum: dagStr, type: matchVandaag.type }
    }
  }

  // v2.4.211: eerstvolgende medische afspraak, zelfde dag-voor-dag-
  // aanpak als werkdiensten hierboven
  const MEDISCH_TYPES = ['huisarts', 'fysiotherapeut', 'sportarts', 'specialist', 'massage', 'medisch_onderzoek', 'vaccinatie']
  const medischEvents = [...eenmaligeEvents, ...alleHerhalendeEvents].filter(e => MEDISCH_TYPES.includes(e.type))
  let volgendeMedischeAfspraak: { datum: string; type: string } | null = null
  for (let i = 0; i < 14; i++) {
    const dagStr = lokaleDagStr(new Date(Date.now() + i * 24 * 60 * 60 * 1000))
    const match = medischEvents.find(e => isEventActiefOpDag(e, dagStr))
    if (match) { volgendeMedischeAfspraak = { datum: dagStr, type: match.type }; break }
  }

  // v2.4.263-FIX: gemeld — "Trainingen komende week" telde gewoon alle
  // training_plan_sessions-rijen, zonder rekening te houden met
  // vakantie. De rijen zelf bestaan nog (al gegenereerd door de rolling
  // horizon, los van vakantie), maar de rest van de app (Today Engine,
  // Week-weergave) stuurt tijdens vakantie terecht om trainen heen —
  // deze teller deed dat niet, wat een misleidend hoog getal gaf tijdens
  // een vakantieweek. Nu: sessies op een dag waarop een actieve
  // 'vakantie'-event geldt, tellen niet mee. Hergebruikt
  // isEventActiefOpDag() — geen nieuwe logica verzonnen.
  const alleEventsVoorVakantieCheck = [...eenmaligeEvents, ...alleHerhalendeEvents]
  const trainingenKomendeWeek = sessies.filter(s => {
    if (s.date > over7Dagen) return false
    const opVakantie = alleEventsVoorVakantieCheck.some(e => e.type === 'vakantie' && isEventActiefOpDag(e, s.date))
    return !opVakantie
  }).length

  return {
    volgendeVakantie: volgendeVakantie ? { datum: lokaleDagStr(new Date(volgendeVakantie.start_time)), eindDatum: volgendeVakantie.end_date } : null,
    volgendEvenement: volgendEvenement ? { datum: lokaleDagStr(new Date(volgendEvenement.start_time)), type: volgendEvenement.type } : null,
    huidigeFase,
    volgendeFaseWissel: volgendeFaseWissel ? { datum: volgendeFaseWissel.date, fase: volgendeFaseWissel.mesocycle_type! } : null,
    werkEventsKomende14Dagen,
    trainingenKomendeWeek,
    volgendeWerkdienst,
    volgendeMedischeAfspraak,
  }
}
