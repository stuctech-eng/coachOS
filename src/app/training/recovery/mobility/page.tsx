'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, ChevronRight, Play, Pause } from 'lucide-react'

interface Oefening {
  naam: string
  instructie: string
  duur: number
}

const SCHEMAS: Record<string, { naam: string; beschrijving: string; oefeningen: Oefening[] }> = {
  hamstring_stretch: {
    naam: 'Hamstring Stretch',
    beschrijving: 'Rek en herstel voor de achterkant van de benen',
    oefeningen: [
      { naam: 'Staande hamstring stretch links', instructie: 'Strek je linkerbeen voor je en buig vanuit de heupen naar voren. Houd je rug recht. Voel de rek achter je linkerbeen.', duur: 45 },
      { naam: 'Staande hamstring stretch rechts', instructie: 'Strek je rechterbeen voor je en buig vanuit de heupen naar voren. Houd je rug recht. Voel de rek achter je rechterbeen.', duur: 45 },
      { naam: 'Liggende hamstring stretch links', instructie: 'Lig op je rug. Trek je linkerbeen omhoog met beide handen achter de knie. Strek het been zo ver als mogelijk. Adem rustig.', duur: 40 },
      { naam: 'Liggende hamstring stretch rechts', instructie: 'Lig op je rug. Trek je rechterbeen omhoog met beide handen achter de knie. Strek het been zo ver als mogelijk. Adem rustig.', duur: 40 },
      { naam: 'Zittende voorwaartse buiging', instructie: 'Zit met gestrekte benen. Buig langzaam naar voren vanuit de heupen. Reik naar je voeten. Houd de positie vast en adem uit.', duur: 50 },
      { naam: 'Staande voorwaartse buiging', instructie: 'Sta met voeten heupbreed. Laat je romp langzaam naar beneden hangen. Knieën licht gebogen. Ontspan je nek en rug volledig.', duur: 40 },
    ],
  },
  hip_flexor: {
    naam: 'Heupbuiger Stretch',
    beschrijving: 'Mobiliteit en rek voor de heupbuigers',
    oefeningen: [
      { naam: 'Uitvalspositie links', instructie: 'Stap met je linkerbeen naar voren. Laat je rechterknee zakken naar de grond. Duw je heupen naar voren en omlaag. Voel de rek voor in de rechterheup.', duur: 45 },
      { naam: 'Uitvalspositie rechts', instructie: 'Stap met je rechterbeen naar voren. Laat je linkerknee zakken naar de grond. Duw je heupen naar voren en omlaag. Voel de rek voor in de linkerheup.', duur: 45 },
      { naam: 'Laag uitval met rotatie links', instructie: 'Ga in een lage uitval links. Draai je bovenlichaam naar links en hef je linkerarm omhoog. Voel de diepe heuprek.', duur: 35 },
      { naam: 'Laag uitval met rotatie rechts', instructie: 'Ga in een lage uitval rechts. Draai je bovenlichaam naar rechts en hef je rechterarm omhoog. Voel de diepe heuprek.', duur: 35 },
      { naam: 'Liggende heupbuiger stretch links', instructie: 'Lig op je rug. Trek je rechterknie naar je borst. Laat je linkerbeen gestrekt op de grond liggen. Voel de rek voor in de linkerheup.', duur: 40 },
      { naam: 'Liggende heupbuiger stretch rechts', instructie: 'Lig op je rug. Trek je linkerknie naar je borst. Laat je rechterbeen gestrekt op de grond liggen. Voel de rek voor in de rechterheup.', duur: 40 },
    ],
  },
  lower_back: {
    naam: 'Onderrug Mobiliteit',
    beschrijving: 'Spanning loslaten in de onderrug',
    oefeningen: [
      { naam: 'Knie naar borst links', instructie: 'Lig op je rug. Trek je linkerknie langzaam naar je borst. Houd vast met beide handen. Voel de rek in je bil en onderrug.', duur: 40 },
      { naam: 'Knie naar borst rechts', instructie: 'Lig op je rug. Trek je rechterknie langzaam naar je borst. Houd vast met beide handen. Voel de rek in je bil en onderrug.', duur: 40 },
      { naam: 'Beide knieën naar borst', instructie: 'Trek beide knieën tegelijk naar je borst. Omarm je benen. Rol zachtjes van links naar rechts om je onderrug te masseren.', duur: 40 },
      { naam: 'Kat-koe stretching', instructie: 'Op handen en knieën. Adem in: laat je buik zakken, hef je hoofd. Adem uit: rond je rug omhoog. Beweeg langzaam mee met je adem.', duur: 45 },
      { naam: 'Kind houding', instructie: 'Zit terug op je hielen, strek je armen voor je uit op de grond. Laat je borst zakken en adem diep in je onderrug.', duur: 50 },
      { naam: 'Liggende wervelrotatie links', instructie: 'Lig op je rug. Laat beide knieën naar links zakken. Armen gespreid. Kijk naar rechts. Voel de rotatie in je wervelkolom.', duur: 40 },
      { naam: 'Liggende wervelrotatie rechts', instructie: 'Lig op je rug. Laat beide knieën naar rechts zakken. Armen gespreid. Kijk naar links. Voel de rotatie in je wervelkolom.', duur: 40 },
    ],
  },
  thoracic: {
    naam: 'Thoracale Mobiliteit',
    beschrijving: 'Borstwervelkolom openen en rotatie verbeteren',
    oefeningen: [
      { naam: 'Thoracale rotatie links', instructie: 'Lig op je zij met knieën gestapeld. Roteer je bovenlichaam naar links. Volg je hand met je blik. Knieën blijven op de grond.', duur: 40 },
      { naam: 'Thoracale rotatie rechts', instructie: 'Lig op je zij met knieën gestapeld. Roteer je bovenlichaam naar rechts. Volg je hand met je blik. Knieën blijven op de grond.', duur: 40 },
      { naam: 'Kattenhouding rotatie', instructie: 'Op handen en knieën. Breng je rechterhand achter je hoofd. Roteer je elleboog naar het plafond. Wissel langzaam.', duur: 40 },
      { naam: 'Zittende rotatie links', instructie: 'Zit rechtop. Draai je bovenlichaam langzaam naar links. Gebruik je rechterhand op je linkerknie als steun. Houd 5 seconden vast.', duur: 35 },
      { naam: 'Zittende rotatie rechts', instructie: 'Zit rechtop. Draai je bovenlichaam langzaam naar rechts. Gebruik je linkerhand op je rechterknie als steun. Houd 5 seconden vast.', duur: 35 },
      { naam: 'Borst opener', instructie: 'Klap je handen achter je rug ineen, hef je borst op en trek je schouderbladen naar elkaar. Houd vast en adem diep in.', duur: 35 },
    ],
  },
  shoulder_mobility: {
    naam: 'Schouder Mobiliteit',
    beschrijving: 'Schoudergewricht openen en stijfheid verminderen',
    oefeningen: [
      { naam: 'Schouder cirkels voorwaarts', instructie: 'Maak grote cirkels met beide schouders naar voren. Beweeg langzaam en volledig. Voel elk deel van het bewegingsbereik.', duur: 35 },
      { naam: 'Schouder cirkels achterwaarts', instructie: 'Maak grote cirkels met beide schouders naar achteren. Haal de schouderbladen samen bij elke cirkel.', duur: 35 },
      { naam: 'Dwarslingse armrek links', instructie: 'Trek je linkerarm horizontaal over je borst. Gebruik je rechterarm om te trekken. Voel de rek in je linkerschouder.', duur: 35 },
      { naam: 'Dwarslingse armrek rechts', instructie: 'Trek je rechterarm horizontaal over je borst. Gebruik je linkerarm om te trekken. Voel de rek in je rechterschouder.', duur: 35 },
      { naam: 'Deurpost stretch links', instructie: 'Zet je linker onderarm verticaal tegen de muur. Draai je lichaam langzaam van de muur weg. Voel de rek in je linkerborst en schouder.', duur: 35 },
      { naam: 'Deurpost stretch rechts', instructie: 'Zet je rechter onderarm verticaal tegen de muur. Draai je lichaam langzaam van de muur weg. Voel de rek in je rechterborst en schouder.', duur: 35 },
    ],
  },
  calf_ankle: {
    naam: 'Kuit & Enkel Mobiliteit',
    beschrijving: 'Herstel en flexibiliteit voor kuiten en enkels',
    oefeningen: [
      { naam: 'Kuit stretch links aan muur', instructie: 'Zet je handen tegen de muur. Strek je linkerbeen achter je met hiel op de grond. Leun naar voren. Voel de rek in je linkerkuit.', duur: 40 },
      { naam: 'Kuit stretch rechts aan muur', instructie: 'Zet je handen tegen de muur. Strek je rechterbeen achter je met hiel op de grond. Leun naar voren. Voel de rek in je rechterkuit.', duur: 40 },
      { naam: 'Enkel cirkels links', instructie: 'Til je linkervoet iets op. Maak grote cirkels met je enkel — 10 keer links, 10 keer rechts. Beweeg langzaam en volledig.', duur: 35 },
      { naam: 'Enkel cirkels rechts', instructie: 'Til je rechtervoet iets op. Maak grote cirkels met je enkel — 10 keer links, 10 keer rechts. Beweeg langzaam en volledig.', duur: 35 },
      { naam: 'Diepe kuit stretch links', instructie: 'Kuit stretch met licht gebogen knie links. Dit rekt de diepere kuitspier. Houd je hiel op de grond.', duur: 35 },
      { naam: 'Diepe kuit stretch rechts', instructie: 'Kuit stretch rechts met licht gebogen knie. Dit rekt de diepere kuitspier. Houd je hiel op de grond.', duur: 35 },
    ],
  },
  recovery_flow: {
    naam: 'Herstel Flow',
    beschrijving: 'Volledige herstelroutine na intensieve training',
    oefeningen: [
      { naam: 'Kat-koe stretching', instructie: 'Op handen en knieën. Adem in: rug hol. Adem uit: rug rond. Langzaam en bewust bewegen.', duur: 40 },
      { naam: 'Kind houding', instructie: 'Zit terug op je hielen, strek je armen voor je uit. Laat je borst zakken en adem diep in je onderrug.', duur: 45 },
      { naam: 'Knie naar borst links', instructie: 'Trek je linkerknie naar je borst. Houd vast. Voel de rek in je bil en onderrug.', duur: 35 },
      { naam: 'Knie naar borst rechts', instructie: 'Trek je rechterknie naar je borst. Houd vast. Voel de rek in je bil en onderrug.', duur: 35 },
      { naam: 'Liggende vlinder', instructie: 'Voetzolen tegen elkaar. Laat je knieën naar buiten zakken. Ontspan je heupen volledig.', duur: 45 },
      { naam: 'Liggende wervelrotatie links', instructie: 'Laat beide knieën naar links zakken. Kijk naar rechts. Voel de rotatie.', duur: 35 },
      { naam: 'Liggende wervelrotatie rechts', instructie: 'Laat beide knieën naar rechts zakken. Kijk naar links. Voel de rotatie.', duur: 35 },
      { naam: 'Savasana', instructie: 'Lig volledig ontspannen op je rug. Armen naast je lichaam. Adem rustig. Laat alle spanning los.', duur: 60 },
    ],
  },
  spine_mobility: {
    naam: 'Wervelkolom Mobiliteit',
    beschrijving: 'Volledige wervelkolom mobiliseren',
    oefeningen: [
      { naam: 'Kat-koe stretching', instructie: 'Op handen en knieën. Adem in: rug hol. Adem uit: rug rond. Langzaam en bewust bewegen.', duur: 45 },
      { naam: 'Zijwaartse buiging links', instructie: 'Sta rechtop. Hef je rechterarm omhoog en buig rustig naar links. Voel de rek langs je rechterzijde.', duur: 35 },
      { naam: 'Zijwaartse buiging rechts', instructie: 'Sta rechtop. Hef je linkerarm omhoog en buig rustig naar rechts. Voel de rek langs je linkerzijde.', duur: 35 },
      { naam: 'Staande rotatie links', instructie: 'Sta met voeten heupbreed. Draai je bovenlichaam langzaam naar links. Houd je heupen stabiel naar voren.', duur: 35 },
      { naam: 'Staande rotatie rechts', instructie: 'Sta met voeten heupbreed. Draai je bovenlichaam langzaam naar rechts. Houd je heupen stabiel naar voren.', duur: 35 },
      { naam: 'Staande voorwaartse buiging', instructie: 'Laat je romp langzaam naar beneden hangen. Knieën licht gebogen. Ontspan nek en rug volledig.', duur: 45 },
      { naam: 'Rol omhoog', instructie: 'Kom wervel voor wervel omhoog vanuit de voorwaartse buiging. Hoofd komt als laatste omhoog.', duur: 30 },
    ],
  },
  neck_shoulders: {
    naam: 'Nek & Schouders',
    beschrijving: 'Bureaumobiliteit — span en stijfheid loslaten',
    oefeningen: [
      { naam: 'Nek kantelen links', instructie: 'Laat je linkeroor langzaam naar je linkerschouder zakken. Voel de rek aan de rechterkant van je nek. Adem rustig door.', duur: 30 },
      { naam: 'Nek kantelen rechts', instructie: 'Laat je rechteroor langzaam naar je rechterschouder zakken. Voel de rek aan de linkerkant van je nek. Adem rustig door.', duur: 30 },
      { naam: 'Nek draaien', instructie: 'Draai je hoofd langzaam naar links, houd 5 seconden vast. Draai dan naar rechts. Herhaal rustig.', duur: 30 },
      { naam: 'Schouderophalers', instructie: 'Trek beide schouders op naar je oren, houd 3 seconden vast en laat ze dan zakken. Herhaal dit ritme.', duur: 30 },
      { naam: 'Schouder cirkels', instructie: 'Maak grote cirkels met beide schouders — eerst naar achter, dan naar voren. Beweeg rustig en volledig.', duur: 40 },
      { naam: 'Borst opener', instructie: 'Klap je handen achter je rug ineen, hef je borst op en trek je schouderbladen naar elkaar. Houd vast en adem in.', duur: 30 },
    ],
  },
  hips: {
    naam: 'Heup mobiliteit',
    beschrijving: 'Herstel & flexibiliteit voor heupen en onderrug',
    oefeningen: [
      { naam: 'Heup cirkels staand', instructie: 'Zet je handen op je heupen en maak grote cirkels met je bekken. 5 rondjes links, dan 5 rondjes rechts.', duur: 40 },
      { naam: 'Uitval links', instructie: 'Stap met je linkervoet naar voren in een diepe uitval. Houd je achterste knie laag boven de grond. Voel de rek in je heupbuiger.', duur: 35 },
      { naam: 'Uitval rechts', instructie: 'Stap met je rechtervoet naar voren in een diepe uitval. Houd je achterste knie laag boven de grond. Voel de rek in je heupbuiger.', duur: 35 },
      { naam: 'Liggende vlinder', instructie: 'Ga op je rug liggen, voetzolen tegen elkaar. Laat je knieën naar buiten zakken. Ontspan je heupen volledig en adem rustig.', duur: 45 },
      { naam: 'Knie naar borst links', instructie: 'Trek je linkerknie naar je borst en houd vast. Voel de rek in je bil en onderrug. Adem uit terwijl je trekt.', duur: 30 },
      { naam: 'Knie naar borst rechts', instructie: 'Trek je rechterknie naar je borst en houd vast. Voel de rek in je bil en onderrug. Adem uit terwijl je trekt.', duur: 30 },
      { naam: 'Duif houding links', instructie: 'Breng je linkerknie naar voren en strek je rechterbeen achter je. Laat je heupen zakken naar de grond. Diepe rek in de heup.', duur: 40 },
      { naam: 'Duif houding rechts', instructie: 'Breng je rechterknie naar voren en strek je linkerbeen achter je. Laat je heupen zakken naar de grond. Diepe rek in de heup.', duur: 40 },
    ],
  },
  full_body: {
    naam: 'Full Body',
    beschrijving: 'Ochtend- of avondroutine voor het hele lichaam',
    oefeningen: [
      { naam: 'Kat-koe stretching', instructie: 'Op handen en knieën. Adem in: laat je buik zakken, hef je hoofd. Adem uit: rond je rug omhoog. Beweeg langzaam mee met je ademhaling.', duur: 40 },
      { naam: 'Kind houding', instructie: 'Zit terug op je hielen, strek je armen voor je uit op de grond. Laat je borst zakken en adem diep in je onderrug.', duur: 40 },
      { naam: 'Wereld grootste stretch links', instructie: 'Stap met je linkervoet naar buiten naast je linkerhand. Draai je linkerarm omhoog naar het plafond. Volg met je blik.', duur: 30 },
      { naam: 'Wereld grootste stretch rechts', instructie: 'Stap met je rechtervoet naar buiten naast je rechterhand. Draai je rechterarm omhoog naar het plafond. Volg met je blik.', duur: 30 },
      { naam: 'Heup scharnieren', instructie: 'Sta met voeten heupbreed. Houd je rug recht en hinge vanuit je heupen naar voren. Voel de rek achter je benen. Kom langzaam omhoog.', duur: 35 },
      { naam: 'Zijwaartse rek links', instructie: 'Hef je linkerarm omhoog en buig rustig naar rechts. Voel de rek langs je linkerzijde. Adem in de rek.', duur: 30 },
      { naam: 'Zijwaartse rek rechts', instructie: 'Hef je rechterarm omhoog en buig rustig naar links. Voel de rek langs je rechterzijde. Adem in de rek.', duur: 30 },
      { naam: 'Staande voorwaartse buiging', instructie: 'Laat je romp langzaam naar beneden hangen, armen los. Buig je knieën lichtjes. Adem diep uit en ontspan je rug en nek volledig.', duur: 40 },
    ],
  },
}

function MobilitySession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subtype = searchParams.get('subtype') || 'full_body'
  const label = searchParams.get('label') || 'Mobiliteit'

  const schema = SCHEMAS[subtype] || SCHEMAS.full_body
  const totaalOefeningen = schema.oefeningen.length

  const [gestart, setGestart] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [oefenIndex, setOefenIndex] = useState(0)
  const [teller, setTeller] = useState(0)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [voltooid, setVoltooid] = useState<number[]>([])

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const huidigeOefening = schema.oefeningen[oefenIndex]
  const totaalDuur = schema.oefeningen.reduce((s, o) => s + o.duur, 0)
  const verlopenDuur = voltooid.reduce((s, i) => s + schema.oefeningen[i].duur, 0) + teller

  const slaOpResultaat = useCallback(async () => {
    try {
      await fetch('/api/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'mobility',
          module: subtype,
          duration: Math.round(totaalDuur / 60),
          completion_status: 'completed',
          recovery_impact: 'medium',
        }),
      })
    } catch { /* */ }
  }, [subtype, totaalDuur])

  useEffect(() => {
    if (!gestart || gepauzeerd || klaar) return

    intervalRef.current = setInterval(() => {
      setTeller(prev => {
        if (prev + 1 >= huidigeOefening.duur) {
          if (oefenIndex + 1 >= totaalOefeningen) {
            setKlaar(true)
            slaOpResultaat()
            return prev
          }
          setVoltooid(v => [...v, oefenIndex])
          setOefenIndex(i => i + 1)
          return 0
        }
        return prev + 1
      })
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [gestart, gepauzeerd, klaar, huidigeOefening, oefenIndex, totaalOefeningen, slaOpResultaat])

  function volgendeManueel() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (oefenIndex + 1 >= totaalOefeningen) {
      setKlaar(true)
      slaOpResultaat()
      return
    }
    setVoltooid(v => [...v, oefenIndex])
    setOefenIndex(i => i + 1)
    setTeller(0)
  }

  const oefVoortgang = teller / huidigeOefening.duur
  const totaalVoortgang = verlopenDuur / totaalDuur

  if (klaar) {
    return (
      <div className="fixed inset-0 bg-coach-dark flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <span className="text-5xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Goed gedaan!</h1>
        <p className="text-slate-400 mb-1">{schema.naam}</p>
        <p className="text-slate-500 text-sm mb-8">{totaalOefeningen} oefeningen · {Math.round(totaalDuur / 60)} minuten</p>
        <button onClick={() => router.push('/training')}
          className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg active:bg-primary-700">
          Terug naar Training
        </button>
      </div>
    )
  }

  if (!gestart) {
    return (
      <div className="fixed inset-0 bg-coach-dark flex flex-col px-6">
        <div className="flex items-center justify-between pt-14 pb-8">
          <button onClick={() => router.push('/training')}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 rounded-full bg-green-500/15 border border-green-500/30 mb-8 flex items-center justify-center">
            <span className="text-5xl">🤸</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{schema.naam}</h1>
          <p className="text-slate-400 text-sm mb-8">{schema.beschrijving}</p>

          <div className="w-full bg-slate-800/50 rounded-2xl p-5 mb-8">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Oefeningen</p>
            <div className="flex flex-col gap-2">
              {schema.oefeningen.map((o, i) => (
                <div key={i} className="flex items-center gap-3 text-left">
                  <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                  <p className="text-sm text-slate-300 flex-1">{o.naam}</p>
                  <span className="text-xs text-slate-500">{o.duur}s</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">{totaalOefeningen} oefeningen · ~{Math.round(totaalDuur / 60)} minuten</p>
          </div>
        </div>

        <div className="pb-12">
          <button onClick={() => setGestart(true)}
            className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700">
            <Play size={22} fill="white" />
            Start sessie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-coach-dark flex flex-col" style={{ background: '#0a0f1a' }}>
      <div className="flex items-center justify-between px-6 pt-14 pb-4">
        <button onClick={() => router.push('/training')}
          className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center">
          <X size={20} className="text-slate-400" />
        </button>
        <p className="text-slate-500 text-sm">{oefenIndex + 1} / {totaalOefeningen}</p>
        <button onClick={() => setGepauzeerd(p => !p)}
          className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center">
          {gepauzeerd ? <Play size={18} className="text-white" /> : <Pause size={18} className="text-white" />}
        </button>
      </div>

      <div className="px-6 mb-6">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${totaalVoortgang * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="relative w-48 h-48 mb-8 flex items-center justify-center">
          <svg width="192" height="192" className="absolute">
            <circle cx="96" cy="96" r="88" fill="none" stroke="#1e293b" strokeWidth="4" />
            <circle cx="96" cy="96" r="88" fill="none"
              stroke="#34d399" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - oefVoortgang)}`}
              transform="rotate(-90 96 96)"
              style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
          </svg>
          <div className="text-center">
            <p className="text-4xl font-bold text-white">{Math.max(huidigeOefening.duur - teller, 0)}</p>
            <p className="text-xs text-slate-500 mt-1">seconden</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-4">{huidigeOefening.naam}</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">{huidigeOefening.instructie}</p>

        {gepauzeerd && <p className="text-slate-600 text-xs mb-4">Gepauzeerd</p>}
      </div>

      <div className="px-6 pb-12">
        <button onClick={volgendeManueel}
          className="w-full py-4 bg-slate-800 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:bg-slate-700">
          {oefenIndex + 1 >= totaalOefeningen ? 'Afronden' : 'Volgende'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

export default function MobilityPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-coach-dark flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
      </div>
    }>
      <MobilitySession />
    </Suspense>
  )
}
