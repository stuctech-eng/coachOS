'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Play, Pause, ChevronRight } from 'lucide-react'

interface Stap {
  titel: string
  instructie: string
  duur: number
}

const COUNTDOWN_DURATION = 5

const SCHEMAS: Record<string, { naam: string; beschrijving: string; stappen: Stap[]; emoji: string }> = {
  progressieve_spierontspanning: {
    naam: 'Progressieve Spierontspanning',
    beschrijving: 'Systematisch aanspannen en ontspannen van spiergroepen',
    emoji: '🌊',
    stappen: [
      { titel: 'Voorbereiding', instructie: 'Lig op je rug in een comfortabele positie. Sluit je ogen. Adem 3 keer diep in en uit. Laat je lichaam zwaar worden.', duur: 30 },
      { titel: 'Voeten', instructie: 'Span je voeten aan — krulde je tenen. Houd 5 seconden vast. Laat los en voel het verschil. Ontspan 10 seconden.', duur: 20 },
      { titel: 'Kuiten', instructie: 'Span je kuiten aan — trek je voeten naar je toe. Houd 5 seconden vast. Laat los. Voel de ontspanning door je onderbenen.', duur: 20 },
      { titel: 'Dijen', instructie: 'Span je dijspieren aan — druk je knieën naar de grond. Houd vast. Laat los. Voel hoe je benen zwaar worden.', duur: 20 },
      { titel: 'Bilspieren', instructie: 'Knijp je bilspieren samen. Houd 5 seconden vast. Laat los. Voel de warmte en ontspanning.', duur: 20 },
      { titel: 'Buik', instructie: 'Span je buikspieren aan alsof iemand je wil stompen. Houd vast. Laat los. Adem diep in je buik.', duur: 20 },
      { titel: 'Handen & Armen', instructie: 'Maak vuisten en span je armen aan. Houd vast. Laat los. Voel hoe de spanning wegvloeit uit je handen en armen.', duur: 20 },
      { titel: 'Schouders', instructie: 'Trek je schouders op naar je oren. Houd vast. Laat vallen. Voel hoe je schouders ontspannen en zakken.', duur: 20 },
      { titel: 'Gezicht', instructie: 'Knijp je ogen dicht, pers je lippen op elkaar en frons. Houd vast. Laat los. Voel hoe je gezicht ontspant.', duur: 20 },
      { titel: 'Volledig lichaam', instructie: 'Voel hoe je hele lichaam ontspannen en zwaar is. Adem rustig. Geniet van de diepe ontspanning. Blijf zo liggen.', duur: 60 },
    ],
  },
  body_scan: {
    naam: 'Body Scan',
    beschrijving: 'Bewust je aandacht door het lichaam bewegen',
    emoji: '👁️',
    stappen: [
      { titel: 'Voorbereiding', instructie: 'Lig comfortabel op je rug. Sluit je ogen. Adem rustig. Laat je lichaam tot rust komen zonder iets te willen veranderen.', duur: 30 },
      { titel: 'Voeten & Enkels', instructie: 'Breng je aandacht naar je voeten. Wat voel je daar? Warmte, koude, tintelingen? Observeer zonder te oordelen. Adem richting je voeten.', duur: 40 },
      { titel: 'Onderbenen', instructie: 'Beweeg je aandacht omhoog naar je kuiten en schenen. Voel het contact met de mat. Observeer alle sensaties. Adem uit en laat los.', duur: 35 },
      { titel: 'Bovenbenen & Heupen', instructie: 'Breng aandacht naar je dijbenen en heupen. Voel het gewicht van je benen. Zijn er plekken van spanning? Adem richting die plekken.', duur: 40 },
      { titel: 'Buik & Onderrug', instructie: 'Voel je buik bewegen met elke ademhaling. Observeer je onderrug — is er spanning? Adem diep in je buik en laat los.', duur: 40 },
      { titel: 'Borst & Bovenrug', instructie: 'Voel je hart kloppen. Voel je longen uitzetten en samentrekken. Zijn er plekken van spanning in je bovenrug? Adem en laat los.', duur: 35 },
      { titel: 'Handen & Armen', instructie: 'Breng aandacht naar je vingers, handen en armen. Voel elk detail. Warmte, zwaarte, tintelingen. Laat alle spanning los bij de uitademing.', duur: 35 },
      { titel: 'Schouders & Nek', instructie: 'Observeer je schouders — draag je spanning? Adem richting je schouders en laat ze zakken bij de uitademing. Doe hetzelfde met je nek.', duur: 40 },
      { titel: 'Hoofd & Gezicht', instructie: 'Voel je kaak, wangen, voorhoofd. Zijn je ogen ontspannen? Laat alle spanning in je gezicht los. Adem rustig.', duur: 35 },
      { titel: 'Heel het lichaam', instructie: 'Voel nu je hele lichaam als één geheel. Ontspannen, zwaar, aanwezig. Adem rustig. Blijf zoveel mogelijk aanwezig in dit moment.', duur: 60 },
    ],
  },
  visualisatie_herstel: {
    naam: 'Visualisatie Herstel',
    beschrijving: 'Mentale techniek die fysiek herstel bevordert',
    emoji: '✨',
    stappen: [
      { titel: 'Inleiding', instructie: 'Lig comfortabel. Sluit je ogen. Adem 3 keer diep in en uit. Ontspan je lichaam volledig. Je gaat je voorstellen hoe je lichaam herstelt.', duur: 30 },
      { titel: 'Doorbloeding', instructie: 'Stel je voor hoe fris, zuurstofrijk bloed door je spieren stroomt. Zie het als een warme, helende stroom. Voel de warmte in je spieren.', duur: 45 },
      { titel: 'Afvoer', instructie: 'Visualiseer hoe afvalstoffen en melkzuur worden afgevoerd. Elke uitademing neemt afvalstoffen mee. Je lichaam reinigt zichzelf.', duur: 40 },
      { titel: 'Herstel spieren', instructie: 'Zie hoe je spiervezels zich herstellen en sterker worden. Kleine scheurtjes worden gevuld met nieuw, sterker weefsel. Jij groeit van deze training.', duur: 45 },
      { titel: 'Energieherstel', instructie: 'Voel hoe energie terugkeert in je lichaam. Glycogeen vult je spieren weer op. Elke ademhaling brengt herstelenergie. Je tank wordt gevuld.', duur: 40 },
      { titel: 'Integratie', instructie: 'Je lichaam is sterker dan voor de training. Voel de kracht en vitaliteit. Je hebt goed getraind. Je lichaam dankbaar je ervoor. Geniet van dit gevoel.', duur: 50 },
    ],
  },
  savasana: {
    naam: 'Savasana',
    beschrijving: 'Volledig ontspannen liggen — integreert de training',
    emoji: '🧘',
    stappen: [
      { titel: 'Positie innemen', instructie: 'Lig op je rug. Armen naast je lichaam, handpalmen omhoog. Voeten iets uiteen, laat ze naar buiten vallen. Sluit je ogen.', duur: 20 },
      { titel: 'Loslaten', instructie: 'Laat je lichaam zwaar worden. Ontspan je rug volledig in de mat. Adem rustig en diep. Je hoeft niets te doen — alleen zijn.', duur: 60 },
      { titel: 'Adem observeren', instructie: 'Observeer je ademhaling zonder die te beïnvloeden. Voel hoe je buik rijst en daalt. Gedachten komen op — laat ze gaan als wolken.', duur: 60 },
      { titel: 'Volledige rust', instructie: 'Volledig stil. Volledig ontspannen. Volledig aanwezig. Er is niets te doen en nergens naartoe te gaan. Laat je lichaam integreren.', duur: 120 },
      { titel: 'Terugkeer', instructie: 'Breng langzaam je bewustzijn terug. Beweeg je vingers en tenen. Adem dieper. Draai naar één kant voor je opstaat. Neem de tijd.', duur: 30 },
    ],
  },
  cooling_down: {
    naam: 'Cooling Down Protocol',
    beschrijving: 'Gestructureerde afkoeling na training',
    emoji: '❄️',
    stappen: [
      { titel: 'Rustig bewegen', instructie: 'Loop 2-3 minuten langzaam door of stap rustig ter plaatse. Laat je hartslag geleidelijk dalen. Adem diep en regelmatig.', duur: 120 },
      { titel: 'Arm strekken', instructie: 'Strek je armen boven je hoofd en rek uit. Buig licht naar links en rechts. Ontspan je schouders en nek.', duur: 30 },
      { titel: 'Been strekken', instructie: 'Strek je quadriceps door je voet naar je bil te trekken. Dan hamstrings — buig voorover. Doe beide benen rustig.', duur: 45 },
      { titel: 'Diepe ademhaling', instructie: 'Sluit je ogen. Adem 4 seconden in door de neus. Houd 2 seconden vast. Adem 6 seconden uit door de mond. Herhaal 5 keer.', duur: 60 },
      { titel: 'Afronding', instructie: 'Voel hoe je lichaam afkoelt en tot rust komt. Drink water. Goed gedaan — je hebt goed getraind en goed afgekoeld.', duur: 30 },
    ],
  },
  diafragma_ademhaling: {
    naam: 'Diafragma Ademhaling',
    beschrijving: 'Buikademhaling voor optimale zuurstofopname',
    emoji: '🌬️',
    stappen: [
      { titel: 'Positie', instructie: 'Lig op je rug of zit comfortabel. Leg één hand op je borst en één op je buik. Ontspan je schouders volledig.', duur: 20 },
      { titel: 'Bewustzijn', instructie: 'Adem normaal en observeer welke hand beweegt. De buikhand moet omhoog komen — niet de borsthand. Zo ademt het diafragma.', duur: 30 },
      { titel: 'Oefenen', instructie: 'Adem langzaam in door de neus — laat alleen je buik uitzetten. De borst blijft zo stil mogelijk. Adem uit — buik zakt.', duur: 60 },
      { titel: 'Verdiepen', instructie: 'Maak de ademhaling langzamer en dieper. 4 seconden in, 6 seconden uit. Voel hoe je lichaam ontspant bij elke uitademing.', duur: 90 },
      { titel: 'Integreren', instructie: 'Adem nu op je eigen ritme — altijd vanuit de buik. Dit is hoe je altijd zou moeten ademen. Voel de rust en energie.', duur: 60 },
    ],
  },
}

function CountdownRing({ seconds, label }: { seconds: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 text-center flex-1">
      <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-3">Klaarmaken</p>
      <p className="text-sm text-slate-300 mb-6">{label}</p>
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg width="128" height="128" className="absolute -rotate-90">
          <circle cx="64" cy="64" r="58" fill="none" stroke="#1e293b" strokeWidth="6" />
          <circle cx="64" cy="64" r="58" fill="none"
            stroke="#a855f7" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 58}`}
            strokeDashoffset={`${2 * Math.PI * 58 * (1 - seconds / COUNTDOWN_DURATION)}`}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <p key={seconds} className="text-6xl font-bold text-white" style={{ animation: 'countdownPulse 1s ease-out' }}>{seconds}</p>
      </div>
      <style>{`@keyframes countdownPulse { 0% { transform: scale(1.4); opacity: 0.3; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  )
}

function RelaxatieSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const label = searchParams.get('label') || 'Ontspanning'
  const terug = searchParams.get('terug') || ''
  const terugUrl = terug ? `/training?herstel=1&terug=${terug}` : '/training?herstel=1'

  function getLabelToSchema(lbl: string): string {
    const map: Record<string, string> = {
      'Progressieve Spierontspanning': 'progressieve_spierontspanning',
      'Body Scan': 'body_scan',
      'Visualisatie Herstel': 'visualisatie_herstel',
      'Savasana': 'savasana',
      'Cooling Down Protocol': 'cooling_down',
      'Diafragma Ademhaling': 'diafragma_ademhaling',
    }
    return map[lbl] || 'savasana'
  }

  const schemaId = getLabelToSchema(label)
  const schema = SCHEMAS[schemaId] || SCHEMAS.savasana
  const totaalStappen = schema.stappen.length

  const [gestart, setGestart] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [countingDown, setCountingDown] = useState(false)
  const [countdownSec, setCountdownSec] = useState(COUNTDOWN_DURATION)
  const [stapIndex, setStapIndex] = useState(0)
  const [teller, setTeller] = useState(0)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [voltooid, setVoltooid] = useState<number[]>([])

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const huidigeStap = schema.stappen[stapIndex]
  const totaalDuur = schema.stappen.reduce((s, st) => s + st.duur, 0)
  const verlopenDuur = voltooid.reduce((s, i) => s + schema.stappen[i].duur, 0) + teller

  const slaOpResultaat = useCallback(async () => {
    try {
      await fetch('/api/recovery/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'relaxation', module: schemaId, duration: Math.round(totaalDuur / 60), completion_status: 'completed', recovery_impact: 'high' }),
      })
    } catch { /* */ }
  }, [schemaId, totaalDuur])

  useEffect(() => {
    if (!countingDown || gepauzeerd) return
    countdownRef.current = setInterval(() => {
      setCountdownSec(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          setCountingDown(false)
          return COUNTDOWN_DURATION
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [countingDown, gepauzeerd])

  useEffect(() => {
    if (!gestart || gepauzeerd || klaar || countingDown || huidigeStap.duur === 0) return

    intervalRef.current = setInterval(() => {
      setTeller(prev => {
        if (prev + 1 >= huidigeStap.duur) {
          if (stapIndex + 1 >= totaalStappen) {
            setKlaar(true)
            slaOpResultaat()
            return prev
          }
          setVoltooid(v => [...v, stapIndex])
          setStapIndex(i => i + 1)
          setCountingDown(true)
          setCountdownSec(COUNTDOWN_DURATION)
          return 0
        }
        return prev + 1
      })
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [gestart, gepauzeerd, klaar, countingDown, huidigeStap, stapIndex, totaalStappen, slaOpResultaat])

  function startSessie() {
    setGestart(true)
    setCountingDown(true)
    setCountdownSec(COUNTDOWN_DURATION)
  }

  function volgendeManueel() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countingDown) {
      if (countdownRef.current) clearInterval(countdownRef.current)
      setCountingDown(false)
      return
    }
    if (stapIndex + 1 >= totaalStappen) {
      setKlaar(true)
      slaOpResultaat()
      return
    }
    setVoltooid(v => [...v, stapIndex])
    setStapIndex(i => i + 1)
    setTeller(0)
    setCountingDown(true)
    setCountdownSec(COUNTDOWN_DURATION)
  }

  const totaalVoortgang = verlopenDuur / totaalDuur
  const stapVoortgang = huidigeStap.duur > 0 ? teller / huidigeStap.duur : 0

  if (klaar) {
    return (
      <div className="fixed inset-0 bg-coach-dark flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center mb-6">
          <span className="text-5xl">{schema.emoji}</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Goed gedaan!</h1>
        <p className="text-slate-400 mb-1">{schema.naam}</p>
        <p className="text-slate-500 text-sm mb-8">{Math.round(totaalDuur / 60)} minuten ontspanning</p>
        <button onClick={() => router.push(terugUrl)}
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
          <button onClick={() => router.push(terugUrl)}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 rounded-full bg-purple-500/15 border border-purple-500/30 mb-8 flex items-center justify-center">
            <span className="text-5xl">{schema.emoji}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{schema.naam}</h1>
          <p className="text-slate-400 text-sm mb-8">{schema.beschrijving}</p>

          <div className="w-full bg-slate-800/50 rounded-2xl p-5 mb-8">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Stappen</p>
            <div className="flex flex-col gap-2">
              {schema.stappen.map((stap, i) => (
                <div key={i} className="flex items-center gap-3 text-left">
                  <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                  <p className="text-sm text-slate-300 flex-1">{stap.titel}</p>
                  <span className="text-xs text-slate-500">{stap.duur}s</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              {totaalStappen} stappen · ~{Math.round(totaalDuur / 60)} minuten
            </p>
          </div>
        </div>

        <div className="pb-12">
          <button onClick={startSessie}
            className="w-full py-4 bg-purple-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-purple-700">
            <Play size={22} fill="white" />
            Start sessie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0a0f1a' }}>
      <div className="flex items-center justify-between px-6 pt-14 pb-4">
        <button onClick={() => router.push(terugUrl)}
          className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center">
          <X size={20} className="text-slate-400" />
        </button>
        <p className="text-slate-500 text-sm">{stapIndex + 1} / {totaalStappen}</p>
        {!countingDown ? (
          <button onClick={() => setGepauzeerd(p => !p)}
            className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center">
            {gepauzeerd ? <Play size={18} className="text-white" /> : <Pause size={18} className="text-white" />}
          </button>
        ) : <div className="w-10 h-10" />}
      </div>

      <div className="px-6 mb-6">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${totaalVoortgang * 100}%` }} />
        </div>
      </div>

      {countingDown ? (
        <CountdownRing seconds={countdownSec} label={huidigeStap.titel} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
            <svg width="160" height="160" className="absolute">
              <circle cx="80" cy="80" r="72" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle cx="80" cy="80" r="72" fill="none"
                stroke="#a855f7" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 72}`}
                strokeDashoffset={`${2 * Math.PI * 72 * (1 - stapVoortgang)}`}
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
            </svg>
            <div className="text-center">
              <span className="text-5xl">{schema.emoji}</span>
              {huidigeStap.duur > 0 && (
                <p className="text-lg font-bold text-purple-400 mt-1">{Math.max(huidigeStap.duur - teller, 0)}s</p>
              )}
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-4">{huidigeStap.titel}</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-8">{huidigeStap.instructie}</p>

          {gepauzeerd && <p className="text-slate-600 text-xs mb-4">Gepauzeerd</p>}
        </div>
      )}

      <div className="px-6 pb-12">
        <button onClick={volgendeManueel}
          className="w-full py-4 bg-slate-800 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 active:bg-slate-700">
          {countingDown ? 'Skip countdown' : stapIndex + 1 >= totaalStappen ? 'Afronden' : 'Volgende stap'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

export default function RelaxatiePage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-coach-dark flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    }>
      <RelaxatieSession />
    </Suspense>
  )
}
