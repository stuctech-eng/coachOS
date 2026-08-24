'use client'
import { ArrowLeft, Brain, Dumbbell, Wind, TrendingUp, Battery, Heart, Zap, Clock, Camera, BarChart2, ChevronDown, Phone, Bike } from 'lucide-react'
import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { cn } from '@/utils'
import Link from 'next/link'

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
      'CoachOS werkt met drie AI-lagen die samenwerken. Coach AI is de baas — hij beslist. Trainer AI voert trainingen uit. Recovery AI begeleidt herstel. Ze overleggen nooit met jou over wie er leidend is: dat is altijd Coach AI.',
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
    intro: 'Garmin is de primaire databron van CoachOS. Via twee dagelijkse screenshots leest de app automatisch je gezondheids- en prestatiedata uit.',
    inhoud: [
      'Waarom screenshots? Garmin heeft geen open API voor alle gezondheidsdata. Twee screenshots van de "In één oogopslag"-pagina (Health-widgets en Performance-widgets) bevatten alles wat Coach AI nodig heeft. Claude Vision leest de waarden er automatisch uit — je hoeft niets handmatig in te typen. Beide foto\'s zijn optioneel en los van elkaar te uploaden.',
      'Health Snapshot: rusthartslag (bpm), Body Battery (0-100), slaapscore (0-100) en slaapduur, HRV 7-daags gemiddelde (ms) en status, stressniveau (0-100), ademhalingsfrequentie in rust en tijdens slaap (brpm).',
      'Performance Snapshot: Training Readiness, trainingslast (acuut/chronisch en de verhouding daartussen), trainingsstatus, focus lading, VO2max en Endurance Score.',
      'De kaart "Garmin data importeren" op Home verdwijnt zodra je vandaag minstens één van de twee screenshots hebt geüpload, en verschijnt de volgende ochtend automatisch weer. Importeer bij voorkeur tussen 07:00 en 08:00 — dan zijn de nachtelijke waarden stabiel en de dagwaarden nog niet vervuild.',
      'Beide foto\'s worden automatisch verkleind voor ze naar de AI gaan. Dit bespaart kosten en maakt de verwerking sneller. Jij merkt er niets van.',
      'Na verwerking zie je meteen de uitgelezen waarden en worden ze direct opgeslagen — geen apart bevestigstapje meer. Coach AI gebruikt zowel de ruwe waarden als je persoonlijke HRV-trend (zie hieronder) voor het dagadvies.',
      'Los van de screenshots kun je in de dagelijkse Check-in ook je ochtend-HRV handmatig invullen (optioneel, met een Overslaan-knop) — dat is een ander getal dan Garmin\'s 7-daags gemiddelde uit de screenshot: de losse waarde van vannacht. CoachOS bouwt hiermee je eigen HRV-baseline op en laat zien of je vandaag boven, onder, of rond je gebruikelijke niveau zit.',
      'Al deze cijfers — en meer — zijn zichtbaar op de Performance-pagina (via Home). Naast Herstel zie je daar ook hoe klaar je bent om vandaag te presteren, je opgebouwde trainingsbelasting (CTL/ATL/TSB) en vermoeidheid, hoe consequent je traint, en fitness-indicatoren zoals uithoudingsvermogen, sprintvermogen, efficiëntie en klimvermogen — elk met een eerlijke betrouwbaarheidsindicatie: hoe meer data er is, hoe zekerder het cijfer. Dit is bewust geen onderdeel van Cycling of Running: het hoort bij je algehele belastbaarheid, niet bij één sport.',
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
      'Coach AI ontvangt elke dag een volledig pakket data: Garmin waarden, je persoonlijke HRV-trend en Performance-cijfers (Training Readiness, VO2max e.d.) indien beschikbaar, check-in, coach score, blessures, levensgebeurtenissen, doelen, trainingshistorie en herstelgeschiedenis. Op basis daarvan genereert hij een aanbeveling en dagplan.',
      'De aanbeveling op Home is zijn kernboodschap voor vandaag — kort en direct. Het dagplan is de uitwerking: concrete acties met tijden. Beide zijn gegenereerd door dezelfde AI met alle context.',
      'Coach AI beslist of je traint of herstelt. Als Body Battery laag is én je slaap slecht was én je stress hoog is → herstel, ongeacht wat jij liever wilt. Het systeem is bewust conservatief omdat overtraining meer schade aanricht dan een gemiste training.',
      'De Coach Chat (tab "Coach") is directe toegang tot Coach AI. Je kunt vragen stellen over je data, uitleg vragen over een beslissing, of feedback geven. De chat heeft toegang tot dezelfde context als het dagplan.',
      'Coach AI heeft een geheugen. Patronen die hij ontdekt worden opgeslagen en meegenomen in toekomstige analyses. Na een week begint hij patronen te herkennen. Na een maand maakt hij voorspellingen.',
      'Toon: Coach AI past zijn toon aan de situatie aan. Bij dagadvies en planning spreekt hij als een betrokken, persoonlijke coach. Bij evaluaties na een training mag hij directer zijn — inclusief een vriendelijk standje als je rust hebt genegeerd.',
    ],
  },
  {
    id: 'specialisten',
    icoon: Bike,
    kleur: 'text-green-400',
    titel: 'Specialisten — verdieping per sport',
    intro: 'Naast Coach AI kun je specialisten activeren: coaches die één sport tot in detail kennen. Op dit moment bestaan de Cycling Coach, de Running Coach, de Rowing Coach en de Kettlebell Coach.',
    inhoud: [
      'Coach AI blijft altijd de baas over je algehele gezondheid en herstel. Een specialist voegt daar diepgaande vakkennis over één sport aan toe — geen aparte chatbot met een andere stem, maar dezelfde coach die je al kent, nu met extra expertise.',
      'Je activeert een specialist via Instellingen, of het systeem stelt het zelf voor: fiets of hardloop je drie keer of vaker binnen een maand, dan verschijnt er een kaartje in de Coach-tab met de vraag of je die specialist wilt inschakelen. Jij beslist altijd zelf — er wordt nooit automatisch iets voor je aangezet.',
      'Eenmaal actief krijg je een eigen scherm (de Hub) met je prestaties, afstand, trainingsfrequentie en -belasting van de afgelopen periode, plus een persoonlijk geschreven advies daarover. Bij Cycling gaat het om vermogen en Power Zones, bij Running om tempo (pace) en Pace Zones — de cijfers zelf worden altijd eerst uitgerekend, de AI verzint nooit een getal, die legt alleen uit wat de cijfers betekenen.',
      'Elke specialist heeft ook een Performance Center: persoonlijke records, een prestatiecurve (vermogen of tempo per duur/afstand) en je trainingsbelasting over tijd. Vraag je een trainingsplan aan, dan bouwt de specialist een meerwekenschema dat zich automatisch aanpast — mis je een training, dan schuift die door; is je herstel laag, dan wordt een zware training vanzelf verzacht. Ook dat gebeurt eerst volledig op basis van vaste regels; de coach legt daarna alleen uit waarom.',
      'Herkent CoachOS ook of je een geplande training daadwerkelijk hebt gedaan? Bij Rowing (via Concept2) inmiddels wel: komt er een sessie binnen die qua datum en duur redelijk overeenkomt met wat er die dag gepland stond, dan wordt de geplande training automatisch als voltooid gemarkeerd — die telt dan niet meer mee als gemist. Voor Running en Cycling volgt dit nog; tot die tijd blijft daar gelden dat een training vooral via de evaluatie na afloop (of een Coach Call) bij de coach bekend wordt.',
      'Na een training kun je je specialist direct laten reageren: open de activiteit en tik op "Laat je Coach analyseren". De app herkent zelf of het een fietsrit of duurloop was — geen keuze nodig. De coach bepaalt eerst objectief je vermogens-/hartslagzone (Cycling) of pace-/hartslagzone en pacing (Running: liep je de tweede helft sneller of langzamer dan de eerste, en hoe gelijkmatig was je tempo), en vergelijkt dat met wat er gepland stond. Pas daarna schrijft hij er een korte, persoonlijke evaluatie bij.',
      'De Kettlebell Coach werkt bewust anders dan de andere drie, en is nog in opbouw. Hij richt zich specifiek op Kettlebell Sport (Girevoy Sport: Jerk, Snatch, Long Cycle, Biathlon) — gewone kettlebelltraining blijft gewoon via Trainer AI lopen, zoals altijd. Log je een sessie, dan houdt hij je persoonlijke records bij en kun je via "Beat My Class" zien hoe je ervoor staat ten opzichte van de officiële WKSF-classificatie (met een duidelijke kanttekening zolang een deel van die koppeling nog niet officieel bevestigd is). Er is ook een "Training genereren"-knop die op verzoek een sessie samenstelt. Wat er bij de andere specialisten al wél is — een automatisch meegroeiend meerwekenschema, en automatische herkenning of je een geplande training echt hebt gedaan — bestaat hier nog niet.',
      'Naast de Hub heeft elke specialist een Progress Center (je doel, persoonlijke records en wat de coach inmiddels over je heeft geleerd, in één overzicht) en een Grafieken-scherm (trends over de afgelopen weken — belasting, tempo/vermogen, hartslag).',
      'De specialist leert je langzaam kennen. Merkt hij een terugkerend patroon op — bijvoorbeeld dat je het beste reageert op lange, rustige inspanningen — dan onthoudt hij dat niet meteen als vaststaand feit. Pas als hetzelfde patroon een paar keer opnieuw naar voren komt, wordt het "bevestigde kennis" die meeweegt in toekomstige adviezen. Een eenmalige observatie telt dus nooit direct mee.',
      'Dat vertrouwen blijft ook niet voor altijd hetzelfde. Verandert je gedrag, en wordt een eerder patroon een tijd niet meer bevestigd, dan laat de coach zijn vertrouwen daarin geleidelijk zakken — net zoals een menselijke coach zijn beeld van je zou bijstellen.',
      'Train je een tijd niet in die sport? Dan verdwijnt er niets. De Hub blijft gewoon zichtbaar, met een melding dat er weinig recente activiteit is. Zodra je weer begint, herkent de coach dat je terugkeert en pakt hij het waar mogelijk weer op waar jullie gebleven waren.',
    ],
  },
  {
    id: 'coach-call',
    icoon: Phone,
    kleur: 'text-amber-400',
    titel: 'Coach Call — evaluatie na training',
    intro: 'Coach AI wil altijd weten wanneer je traint — of dat nu via Strava, het Archief of de Trainingsbibliotheek is. Dit is geen formulier — dit is een gesprek.',
    inhoud: [
      'Een Coach Call kan op twee manieren ontstaan, met elk een andere reden.',
      'Strava-activiteiten: hier is de Coach Call de enige manier waarop Coach AI iets over de belasting te weten komt — een Strava-rit heeft zelf geen evaluatiescherm. Een activiteit kwalificeert als de duur 30 minuten of langer is, óf als de afstand voldoende is: 5 km voor hardlopen, 20 km voor fietsen, 5 km voor roeien. Het is genoeg als één van de twee klopt — niet beide tegelijk nodig. Dit is bewust zo ingericht voor herstelfases: een sessie die niet ver komt maar wel lang duurt telt net zo goed mee als een korte, snelle sessie.',
      'Archief en Trainingsbibliotheek: deze trainingen hebben al hun eigen evaluatiescherm (RPE, energie, techniek) vóórdat ze worden opgeslagen — die data mist dus nooit. De Coach Call dient hier een ander doel: Coach AI melden dát er buiten zijn eigen advies om is getraind, ongeacht wat hij die dag had aanbevolen. Dit gebeurt altijd, bij elke training via Archief of Trainingsbibliotheek — niet alleen als zijn advies toevallig herstel of rust was.',
      'Op de Home pagina verschijnt een amber kaart zodra er een Coach Call klaarstaat. De kaart verdwijnt automatisch na 24 uur als je hem niet invult.',
      'Bij een Strava-activiteit vul je twee dingen in: RPE (hoe zwaar was het, schaal 1-10) en Mood (hoe voelde je je erbij, van 😞 tot 🔥). Dit zijn bewust twee aparte vragen — RPE meet de fysieke belasting, Mood meet de beleving. Ze kunnen ver uit elkaar liggen: een zware sessie kan geweldig aanvoelen, een lichte sessie kan frustrerend zijn.',
      'Optioneel kun je ook een korte notitie toevoegen per activiteit — wat je opviel, hoe het voelde, iets wat je wilt onthouden.',
      'Zodra je op "Evaluatie versturen" drukt, reageert Coach AI direct met een persoonlijke reactie op die ene activiteit. Hij kijkt naar de combinatie van RPE en Mood en geeft zijn oordeel — soms complimenteus, soms kritisch, soms met humor. Had Coach AI rust aangeraden en ben je toch gaan trainen? Dan mag hij daar iets van vinden.',
      'De evaluatiedata (RPE, mood, coach-reactie) wordt opgeslagen per activiteit. In de toekomst maakt dit analyses mogelijk: welke trainingen geven energie, bij welke sport voel je je het best, wanneer loopt de belasting te hoog op.',
    ],
  },
  {
    id: 'strava',
    icoon: TrendingUp,
    kleur: 'text-orange-400',
    titel: 'Strava koppeling & activiteiten',
    intro: 'Strava is de bron voor je activiteitendata. CoachOS synchroniseert automatisch en toont je sessies met alle details.',
    inhoud: [
      'Koppelen doe je via Instellingen → Strava → Verbind Strava. Na autorisatie synchroniseert de app automatisch je activiteiten van de afgelopen 30 dagen. Daarna kun je handmatig synchroniseren via de knop "Activiteiten synchroniseren".',
      'Per activiteit worden opgeslagen: sport, datum, duur, afstand, gemiddelde en maximale hartslag, hoogteverschil, snelheid en calorieën. Watts en cadans worden meegenomen als Strava ze aanlevert.',
      'De Activiteiten pagina bereik je via Instellingen → Strava → Bekijk activiteiten. Je ziet hier alle gesynchroniseerde sessies, gefilterd per sporttype. Tik op een Strava-activiteit om hem direct in Strava te openen — je ziet dan de volledige route, splits en alle details die Strava heeft.',
      'Garmin activiteiten kun je ook handmatig importeren via een .gpx of .tcx bestand — dit staat ook op de Activiteiten pagina.',
      'Coach AI gebruikt je Strava-historie als context voor trainingsadviezen. Trainer AI gebruikt de hardloop- en fietshistorie om een realistisch niveau in te schatten voor de volgende sessie.',
    ],
  },
  {
    id: 'trainer-ai',
    icoon: Dumbbell,
    kleur: 'text-orange-400',
    titel: 'Trainer AI & Training Engine',
    intro: 'Trainer AI genereert trainingen op maat voor jouw beschikbare equipment. De Universal Training Engine begeleidt je vervolgens stap voor stap door de sessie.',
    inhoud: [
      'Equipment profiel: in Instellingen geef je aan welke materialen je hebt (kettlebell, dumbbells, barbell, concept2, hometrainer, hardlopen, ab wheel, bodyweight). Trainer AI genereert alleen sessies met materiaal dat je daadwerkelijk hebt.',
      'Trainer AI houdt rekening met je ervaringsniveau, Body Battery, je laatste check-in (energie, stress, spierpijn), actieve blessures en je doelen. Bij lage energie of spierpijn kiest hij lichtere oefeningen of minder sets. Blessures sluiten automatisch bepaalde oefeningen uit.',
      'Trainingsschema: op de Training tab zie je het overzicht van alle oefeningen met sets, herhalingen en rust. Druk op "Training Starten" om te beginnen.',
      'Eerste oefening: voor je start zie je de volledige uitleg — uitvoering, coaching tip en veelgemaakte fouten. Druk op "Ready" om te beginnen. Vanaf hier loopt alles automatisch.',
      'Automatische flow: elke set start automatisch. Bij herhalingen rekent de engine dit om naar tijd op basis van jouw tempo-instelling (Slow, Normaal of Fast — per oefening apart onthouden). Na de set volgt automatisch rust, dan de volgende set.',
      'Laatste rust: tijdens de laatste rust van een oefening verschijnt automatisch de uitleg van de volgende oefening, met de resterende rusttijd rechtsboven. Zodra de rust afloopt start de volgende oefening — geen extra actie nodig.',
      'Navigatie tijdens de training: Back gaat naar de uitleg van de vorige oefening, Volgend naar de volgende — beide stoppen de automatische flow en resetten de timer. Next slaat alleen de huidige stap over zonder de flow te onderbreken. Druk op Ready om de automatische flow weer te starten.',
      'Pause stopt de training direct met een overzicht van waar je was. Hervatten gaat verder vanaf exact dat punt, of stop de training helemaal met een bevestiging.',
      'Na de laatste oefening zie je je statistieken: voltooide oefeningen, overgeslagen oefeningen en totaal aantal sets. Daarna volgt de evaluatie: hoe zwaar was de training, je energieniveau en techniekgevoel, plus opmerkingen.',
      'Sessie herstel: sluit je de app halverwege een training? Bij terugkomst vraagt de app of je wilt hervatten vanaf je laatste positie of opnieuw beginnen.',
      'Rowing, hardlopen, fietsen: elk met hun eigen sessietype-keuze door Trainer AI, passend bij je herstel. Modules waarvoor je geen equipment hebt zijn uitgeschakeld — je kunt ze instellen via het Equipment profiel.',
      'Trainingsbibliotheek: naast het dagadvies kun je ook zelf een module kiezen. Trainer AI bepaalt dan het sessietype op basis van je actuele data. Alle trainingen tellen volledig mee voor je progressie, en triggeren — net als het Archief — altijd een Coach Call zodat Coach AI weet dat je buiten zijn advies om hebt getraind.',
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
      'Coach inzichten zijn AI-gegenereerde patronen. Coach AI kijkt naar correlaties in je data — wat heeft invloed op wat? Inzichten worden automatisch bijgewerkt als je de app opent.',
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
      'HRV (ms): hartritmevariabiliteit, het 7-daags gemiddelde. Dit meet de variatie tussen hartslagen. Hoger is beter — het betekent dat je zenuwstelsel flexibel en veerkrachtig is.',
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
    intro: 'CoachOS houdt rekening met wat er in je leven speelt. Blessures en levensgebeurtenissen beïnvloeden direct de adviezen van zowel Coach AI als het dagplan.',
    inhoud: [
      'Blessures registreer je via Instellingen → Blessures. Geef aan welk lichaamsdeel, hoe ernstig (pijnscore 1-10) en of het actief is. Trainer AI filtert automatisch oefeningen die dat lichaamsdeel belasten.',
      'Een schouderklacht betekent geen press, overhead carry of Turkish Get-Up. Een knieklacht betekent geen squat varianten. Coach AI past ook het dagplan aan — geen wandelingen bij een voetblessure.',
      'Levensgebeurtenissen registreer je via Instellingen → Levensgebeurtenissen. Coach AI luistert naar alle vier categorieën: Werk (nachtdienst, vroege dienst, werkstress), Leven (vakantie, reizen, feest, jetlag), Gezondheid (ziek, slecht geslapen, emotionele stress) en Omgeving (extreme hitte). Niet alleen werkdiensten, maar alles wat je invult telt mee.',
      'De notitie bij een levensgebeurtenis wordt ook meegelezen — als je bij een nachtdienst schrijft "was extra druk", weet Coach AI dat ook. Vul het in, de coach leest het.',
      'Levensgebeurtenissen kunnen herhalend zijn — werkdagen, weekdagen of aangepaste dagen. Stel je roosters in en Coach AI past zich automatisch aan zonder dat je het elke dag opnieuw hoeft in te geven. Je kunt bestaande events ook bewerken: datum, tijden en herhaling zijn aanpasbaar zonder dat je het event hoeft te verwijderen.',
      'Coach AI en het dagplan zien altijd exact dezelfde levensgebeurtenissen — er is één gedeelde databron. Dit voorkomt dat het dagplan iets weet wat het coach-advies niet weet, of andersom.',
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
        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
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
  // v2.4.14: versienummer komt uit package.json (via /api/version), niet
  // meer hardcoded. package.json is de enige bron van waarheid — zie
  // README sectie "Versienummer — één bron van waarheid".
  const [versie, setVersie] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/version')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.version) setVersie(data.version) })
      .catch(() => {})
  }, [])

  return (
    <AppShell showNav={false}>
      <div className="flex items-center gap-3 px-4 pt-14 pb-6">
        <Link href={'/settings'}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-400" />
        </Link>
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
            CoachOS {versie ? `v${versie}` : ''} — wordt bijgewerkt bij elke versie
          </p>
        </div>
      </div>
    </AppShell>
  )
}
