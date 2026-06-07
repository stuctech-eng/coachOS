'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Brain, Dumbbell, Wind, TrendingUp, Battery, Moon, Heart, Zap, Clock, Camera, BarChart2, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '@/components/layout'
import { cn } from '@/utils'

interface Sectie {
  id: string
  icoon: React.ElementType
  kleur: string
  titel: string
  intro: string
  inhoud: string[]
}

const SECTIES: Sectie[] = [
  {
    id: 'kern',
    icoon: Brain,
    kleur: 'text-primary-400',
    titel: 'Wat is CoachOS',
    intro: 'CoachOS is een AI Coaching Operating System — geen gewone fitnessapp, maar een systeem dat leert hoe jouw lichaam reageert en daar dagelijks op inspeelt.',
    inhoud: [
      'De kern van CoachOS is één vraag: wat heeft jouw lichaam vandaag nodig? Niet wat een gemiddeld persoon nodig heeft, maar jij — op basis van jouw slaap, herstel, stress en trainingshistorie.',
      'CoachOS werkt met drie AI-lagen die samenwerken. Coach AI is de baas — hij beslist. Trainer AI voert trainingen uit. Recovery AI begeleid herstel. Ze overleggen nooit met jou over wie er leidend is: dat is altijd Coach AI.',
      'Het systeem groeit mee. Hoe meer data je geeft, hoe slimmer de adviezen worden. Na een week zie je patronen. Na een maand worden de voorspellingen nauwkeuriger. Na drie maanden kent het systeem jouw lichaam beter dan jijzelf.',
    ],
  },
  {
    id: 'dagelijks',
    icoon: Clock,
    kleur: 'text-blue-400',
    titel: 'Dagelijkse flow',
    intro: 'CoachOS werkt het beste als je elke ochtend dezelfde routine volgt. Dit kost je in totaal 3-5 minuten.',
    inhoud: [
      '07:00-08:00 — Garmin screenshot importeren. Open Garmin Connect, ga naar "In één oogopslag" en maak een screenshot. Upload dit in CoachOS via Instellingen → Garmin Import. De app leest automatisch je rusthartslag, Body Battery, slaap, HRV, stress en ademhaling uit.',
      '08:00 — Check-in invullen. Hoe voel je je? Hoeveel energie heb je? Hoe hoog is je stress? Dit zijn jouw subjectieve signalen. CoachOS combineert dit met de objectieve Garmin data voor een compleet beeld.',
      'Na de check-in berekent Coach AI je Coach Score en genereert hij een dagplan. Dit staat klaar op de Home pagina. Het dagplan houdt rekening met je werk, levensgebeurtenissen, blessures en herstelstatus.',
      'Overdag — volg het dagplan. Als er een training aanbevolen wordt: ga naar Training → Start. Trainer AI genereert een sessie op maat. Na afloop geef je een rating en eventuele opmerkingen. Die feedback gebruikt Coach AI morgen.',
      'Avond — optioneel een herstelmodule doen via Training → Herstelbibliotheek. Ademhaling, mobiliteit of een wandeling.',
    ],
  },
  {
    id: 'garmin',
    icoon: Camera,
    kleur: 'text-blue-400',
    titel: 'Garmin Import',
    intro: 'Garmin is de primaire databron van CoachOS. Via een dagelijkse screenshot leest de app automatisch je gezondheidsdata uit.',
    inhoud: [
      'Waarom een screenshot? Garmin heeft geen open API voor alle gezondheidsdata. Een screenshot van het "In één oogopslag" scherm bevat alles wat Coach AI nodig heeft. Claude Vision leest de waarden er automatisch uit — je hoeft niets handmatig in te typen.',
      'Wat wordt er uitgelezen? Rusthartslag (bpm), Body Battery (0-100), Slaapscore (0-100) en slaapduur, HRV 7-daags gemiddelde (ms) en status, Stressniveau (0-100), Ademhalingsfrequentie in rust en tijdens slaap (brpm).',
      'Het bolletje naast Coach Score op Home toont de status: groen = import van vandaag, geel = import van gisteren, grijs = geen recente data. Importeer bij voorkeur tussen 07:00 en 08:00 — dan zijn de nachtelijke waarden stabiel en de dagwaarden nog niet vervuild.',
      'De foto wordt automatisch verkleind voor hij naar de AI gaat. Dit bespaart kosten en maakt de verwerking sneller. Jij merkt er niets van.',
      'Na import zie je een preview met alle uitgelezen waarden. Controleer ze even — klopt er iets niet, upload dan opnieuw. Zodra je bevestigt, slaat de app de data op en gebruikt Coach AI deze voor het dagplan.',
    ],
  },
  {
    id: 'coach-score',
    icoon: Zap,
    kleur: 'text-yellow-400',
    titel: 'Coach Score',
    intro: 'De Coach Score is een getal van 0 tot 100 dat weergeeft hoe klaar je lichaam vandaag is. Het is geen fitnessscore maar een readiness score.',
    inhoud: [
      'De Coach Score bestaat uit drie componenten: Herstel (40%), Training (30%) en Leefstijl (30%). Herstel weegt het zwaarst omdat zonder herstel geen vooruitgang mogelijk is.',
      'Herstel wordt berekend op basis van je Garmin data (Body Battery, slaap, HRV, hartslag) en je check-in (hoe voel je je, hoeveel energie). Levensgebeurtenissen zoals nachtdiensten of hoge stress verlagen de herstelscore.',
      'Training kijkt naar je trainingsbelasting van de afgelopen week. Te weinig training → lage score. Te veel zonder herstel → ook lagere score. Het systeem zoekt de balans.',
      'Leefstijl analyseert trends over de afgelopen 30 dagen. Worden je herstelwaarden beter of slechter? Is er een patroon in slechte nachten?',
      'Score 75-100: klaar voor training. Score 50-74: voorzichtig, lichte training of herstel. Score 0-49: focus op herstel, geen zware training.',
      'De score wordt elke ochtend automatisch herberekend zodra je de app opent. Je kunt hem ook handmatig vernieuwen via de refresh knop op Home.',
    ],
  },
  {
    id: 'coach-ai',
    icoon: Brain,
    kleur: 'text-primary-400',
    titel: 'Coach AI',
    intro: 'Coach AI is de kern van het systeem. Hij analyseert alle data en neemt beslissingen. Jij voert uit, Coach AI denkt.',
    inhoud: [
      'Coach AI ontvangt elke dag een volledig pakket data: Garmin waarden, check-in, coach score, blessures, levensgebeurtenissen, doelen, trainingshistorie en herstelgeschiedenis. Op basis daarvan genereert hij een aanbeveling en dagplan.',
      'De aanbeveling op Home is zijn kernboodschap voor vandaag — kort en direct. Het dagplan is de uitwerking: concrete acties met tijden. Beide zijn gegenereerd door dezelfde AI met alle context.',
      'Coach AI beslist of je traint of herstelt. Als Body Battery laag is én je slaap slecht was én je stress hoog is → herstel, ongeacht wat jij liever wilt. Het systeem is bewust conservatief omdat overtraining meer schade aanricht dan een gemiste training.',
      'De Coach Chat (tab "Coach") is directe toegang tot Coach AI. Je kunt vragen stellen over je data, uitleg vragen over een beslissing, of feedback geven. De chat heeft toegang tot dezelfde context als het dagplan.',
      'Coach AI heeft een geheugen. Patronen die hij ontdekt worden opgeslagen en meegenomen in toekomstige analyses. Na een week begint hij patronen te herkennen. Na een maand maakt hij voorspellingen.',
      'Voorspellingen staan op Home. Ze zijn gebaseerd op trends in je data. "Kans op goede trainingsdag morgen: 78%" betekent dat Coach AI op basis van je huidige hersteltrend verwacht dat je morgen klaar bent voor een goede sessie.',
    ],
  },
  {
    id: 'trainer-ai',
    icoon: Dumbbell,
    kleur: 'text-orange-400',
    titel: 'Trainer AI',
    intro: 'Trainer AI genereert kettlebell trainingen op maat. Hij ontvangt instructies van Coach AI en bouwt daar een concrete sessie van.',
    inhoud: [
      'Trainer AI werkt met 25 oefeningen verdeeld over zes categorieën: Hinge, Squat, Push, Pull, Carry en Core. Elke oefening heeft een niveau (1=beginner, 2=gemiddeld, 3=gevorderd).',
      'Een sessie heeft altijd dezelfde opbouw: Warming-up (Hinge + Squat), Trainingsblokken (Hinge → Squat → Push of Pull → Carry of Core → Finisher), Cool-down. Dit zorgt voor een gebalanceerde full-body training elke keer.',
      'Trainer AI houdt rekening met vier factoren: je ervaringsniveau (uit profiel), Body Battery (uit Garmin), je ratings van de laatste drie trainingen, en actieve blessures. Blessures wegen het zwaarst — een geblesseerde schouder betekent geen press of overhead oefeningen, ongeacht de rest.',
      'Progressie werkt automatisch. Als je drie trainingen achter elkaar een rating van 8 of hoger geeft én je Body Battery is boven de 70 → verhoogt Trainer AI het moeilijkheidsniveau. Rating van 4 of lager → stap terug. Dit gebeurt zonder dat je er iets voor hoeft te doen.',
      'Na elke training vul je een rating (1-10) in en optioneel opmerkingen. "Schouders voelden zwaar" of "veel energie vandaag" — die tekst gebruikt Coach AI later voor analyse. Hoe meer je invult, hoe slimmer het systeem wordt.',
    ],
  },
  {
    id: 'recovery-ai',
    icoon: Wind,
    kleur: 'text-blue-400',
    titel: 'Recovery AI',
    intro: 'Recovery AI begeleidt herstelmodules. Hij bepaalt niet wanneer je herstelt — dat doet Coach AI — maar hij voert het uit.',
    inhoud: [
      'Er zijn drie soorten herstelmodules: Ademhaling, Mobiliteit en Wandeling. Coach AI kiest welke modules hij aanbeveelt op basis van je herstelstatus en levensgebeurtenissen.',
      'Ademhaling: vier schemas — Box Breathing (4-4-4-4, stressreductie), 4-7-8 (ontspanning en slaap), Coherent Breathing (HRV verbetering) en Stress Reset (snel kalmeren). Elke sessie heeft een timer die je door de fases leidt.',
      'Mobiliteit: drie routines — Nek & Schouders (bureauklachten), Heupen (herstel en flexibiliteit) en Full Body (ochtend of avondroutine). Per oefening een timer en instructies.',
      'Wandeling: een herstelwandeling met timer. Lage intensiteit, bewuste beweging voor actief herstel.',
      'Via de Herstelbibliotheek in Training kun je altijd handmatig een module kiezen, ongeacht wat Coach AI aanbeveelt. Soms wil je gewoon even ademhalen.',
    ],
  },
  {
    id: 'progressie',
    icoon: TrendingUp,
    kleur: 'text-green-400',
    titel: 'Progressie',
    intro: 'De Progressie tab is jouw dagelijkse spiegel. Hij laat zien hoe je ervoor staat — niet wat je moet doen, maar waar je staat.',
    inhoud: [
      'Vandaag toont je huidige Body Battery, herstelstatus en slaapscore. Dit zijn de drie meest directe indicatoren van hoe je lichaam er nu voorstaat.',
      'Deze week toont het aantal trainingen, gemiddelde rating, totale trainingstijd en de trend ten opzichte van vorige week. Een stijgende trend betekent dat je consistenter traint en beter herstelt.',
      'Deze maand geeft een breder beeld. Is de trend over langere tijd positief? Dat is het doel.',
      'Persoonlijke records: langste streak actieve dagen, beste week, hoogste rating ooit en totale trainingstijd. Deze groeien mee naarmate je langer met de app werkt.',
      'Grafieken: rating trend per sessie (zie je verbetering?) en trainingstijd per week (zie je consistentie?). Na drie maanden worden deze grafieken echt waardevol.',
    ],
  },
  {
    id: 'inzichten',
    icoon: BarChart2,
    kleur: 'text-purple-400',
    titel: 'Inzichten',
    intro: 'Inzichten combineert Garmin grafieken, trends en Coach AI analyse in één overzicht. Dit is de analytische laag van CoachOS.',
    inhoud: [
      'Garmin grafieken tonen 14 dagen data: rusthartslag, Body Battery, slaapscore, slaapduur, HRV, stress en ademhaling. Elke grafiek toont de trend en het laatste gemeten getal. Na 3+ imports beginnen de grafieken interessant te worden.',
      'Trends analyseren de richting van je herstelwaarden over 7-30 dagen. Een stijgende HRV en dalende rusthartslag zijn tekenen van verbetering. Een stijgende stress en dalende slaapscore zijn waarschuwingssignalen.',
      'Coach inzichten zijn AI-gegenereerde patronen. Coach AI kijkt naar correlaties in je data — wat heeft invloed op wat? "Herstel correleert sterk met coach score (r=0.95)" betekent dat als je herstel stijgt, je coach score bijna altijd meestijgt.',
      'De inzichten worden automatisch bijgewerkt als je de app opent. Als de laatste analyse van gisteren is, draait hij stilletjes een nieuwe op de achtergrond. Je kunt ook handmatig vernieuwen via de refresh knop.',
      'Inzichten zijn bereikbaar via Instellingen → Inzichten. Ze zijn bewust niet in de hoofdnavigatie — dit is een analyse-scherm, geen dagelijks scherm.',
    ],
  },
  {
    id: 'herstel-data',
    icoon: Heart,
    kleur: 'text-red-400',
    titel: 'Hersteldata begrijpen',
    intro: 'Coach AI gebruikt specifieke Garmin waarden om te bepalen hoe goed je hersteld bent. Dit is wat ze betekenen.',
    inhoud: [
      'Body Battery (0-100): Garmin\'s eigen herstelindex. Combineert slaap, HRV en activiteit. Onder 40 = laag, 40-70 = normaal, boven 70 = goed geladen. Dit is de meest directe indicator voor trainingsbereidheid.',
      'Rusthartslag (bpm): je hartslag in volledige rust, gemeten tijdens slaap. Lager is beter. Als je rusthartslag hoger is dan normaal, is je lichaam harder aan het werken — teken van stress of ziekte.',
      'HRV (ms): hartritmevariabiliteit, het 7-daags gemiddelde. Dit meet de variatie tussen hartslagen. Hoger is beter — het betekent dat je zenuwstelsel flexibel en veerkrachtig is. Garmin toont dit als 7-daags gemiddelde om dagelijkse ruis te filteren.',
      'Slaapscore (0-100): Garmin\'s beoordeling van je slaapkwaliteit. Onder 70 is matig. Combineer dit altijd met de slaapduur — een score van 80 bij 5 uur slaap is anders dan bij 8 uur.',
      'Stress (0-100): Garmin\'s stressmeting op basis van HRV-variaties overdag. Onder 25 = rust, 26-50 = licht, 51-75 = matig, boven 75 = hoog. Hoge stress + lage Body Battery = zeker geen zware training.',
      'Ademhaling (brpm): ademfrequentie in rust. Normaal 12-20 brpm. De slaapademhaling is het meest stabiel en relevant. Een lagere slaapademhaling is een teken van diepe ontspanning en goed herstel.',
    ],
  },
  {
    id: 'blessures',
    icoon: Zap,
    kleur: 'text-amber-400',
    titel: 'Blessures & levensgebeurtenissen',
    intro: 'CoachOS houdt rekening met wat er in je leven speelt. Blessures en levensgebeurtenissen beïnvloeden direct de adviezen.',
    inhoud: [
      'Blessures registreer je via Instellingen → Blessures. Geef aan welk lichaamsdeel, hoe ernstig (pijnscore 1-10) en of het actief is. Trainer AI filtert automatisch oefeningen die dat lichaamsdeel belasten.',
      'Een schouderklacht betekent geen press, overhead carry of Turkish Get-Up. Een knieklacht betekent geen squat varianten. Coach AI past ook het dagplan aan — geen wandelingen bij een voetblessure.',
      'Levensgebeurtenissen registreer je via Instellingen → Levensgebeurtenissen. Nachtdienst, vroege dienst, hoge werkdruk, vakantie — dit heeft allemaal invloed op herstel. Coach AI houdt hier rekening mee bij het dagplan.',
      'Een nachtdienst heeft impact op drie factoren: herstel, stress en slaap. Coach AI verlaagt de trainingsintensiteit automatisch na een nachtdienst en plant meer herstelactiviteiten.',
      'Levensgebeurtenissen kunnen herhalend zijn — werkdagen, weekdagen of aangepaste dagen. Stel je roosters in en Coach AI past zich automatisch aan zonder dat je het elke dag opnieuw hoeft in te geven.',
    ],
  },
]

function SectieKaart({ sectie }: { sectie: Sectie }) {
  const [open, setOpen] = useState(false)
  const Icon = sectie.icoon

  return (
    <div className="rounded-2xl bg-white/5 border border-white/8 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full px-4 py-4 active:bg-white/5"
      >
        <div className={cn('w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0')}>
          <Icon size={18} className={sectie.kleur} />
        </div>
        <p className="flex-1 text-left text-sm font-semibold text-white">{sectie.titel}</p>
        <ChevronDown
          size={16}
          className={cn('text-slate-500 transition-transform duration-200 flex-shrink-0', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-4 border-t border-white/5 pt-4">
          <p className="text-sm text-primary-400 leading-relaxed font-medium">{sectie.intro}</p>
          {sectie.inhoud.map((alinea, i) => (
            <p key={i} className="text-sm text-slate-300 leading-relaxed">{alinea}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HoeWerktHetPage() {
  const router = useRouter()

  return (
    <AppShell showNav={false}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-6">
        <button
          onClick={() => router.push('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-400" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Hoe werkt CoachOS</h1>
          <p className="text-xs text-white/40 mt-0.5">Uitleg, logica en flow</p>
        </div>
      </div>

      <div className="px-4 pb-10 space-y-3">
        <div className="rounded-2xl bg-primary-500/10 border border-primary-500/20 px-4 py-3 mb-5">
          <p className="text-sm text-primary-300 leading-relaxed">
            CoachOS leert hoe jouw lichaam reageert en speelt daar dagelijks op in. Hoe meer je het gebruikt, hoe slimmer het wordt.
          </p>
        </div>

        {SECTIES.map(sectie => (
          <SectieKaart key={sectie.id} sectie={sectie} />
        ))}

        <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-4 mt-2">
          <p className="text-xs text-slate-500 text-center">
            CoachOS v{process.env.NEXT_PUBLIC_APP_VERSION || '4.9.0'} — wordt bijgewerkt bij elke versie
          </p>
        </div>
      </div>
    </AppShell>
  )
}
