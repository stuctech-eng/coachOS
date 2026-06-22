// ── CoachOS Bodyweight Bibliotheek — Fase 1 ──────────────────────────────────
// 30 oefeningen verdeeld over 5 coachDoelen.
// Architectuur: Coach bepaalt doel + duur + belasting →
// Route filtert op coachDoelen → Trainer AI krijgt lijst + maakt sessie.

export type CoachDoel =
  | 'kracht'
  | 'conditie'
  | 'herstel'
  | 'mobiliteit'
  | 'warmup'
  | 'core'

export type Lichaamsdeel =
  | 'benen'
  | 'bilspieren'
  | 'core'
  | 'borst'
  | 'rug'
  | 'schouders'
  | 'volledig'

export type Niveau = 'beginner' | 'gemiddeld' | 'gevorderd'

export interface BodyweightOefening {
  id: string
  naam: string
  categorie: string
  lichaamsdelen: Lichaamsdeel[]
  coachDoelen: CoachDoel[]
  niveau: Niveau
  duur?: number           // seconden (voor tijdgebaseerde oefeningen)
  herhalingen?: string    // bijv. "10-15" of "zoveel mogelijk"
  uitleg: string          // korte uitleg voor de prompt
  beschrijving: string    // volledige uitleg voor de uitlegpagina
  tips: string[]
  fouten: string[]
  primaireSpieren: string[]
  secundaireSpieren: string[]
  herstel: boolean        // geschikt als herstel-oefening
  mobiliteit: boolean     // heeft mobiliteitscomponent
}

export const BODYWEIGHT_OEFENINGEN: BodyweightOefening[] = [

  // ── RECOVERY (5) ──────────────────────────────────────────────────────────

  {
    id: 'box-breathing',
    naam: 'Box Breathing',
    categorie: 'Herstel',
    lichaamsdelen: ['volledig'],
    coachDoelen: ['herstel'],
    niveau: 'beginner',
    duur: 240,
    uitleg: 'Adem 4 seconden in, houd 4 seconden vast, adem 4 seconden uit, houd 4 seconden vast. Herhaal.',
    beschrijving: 'Ga zitten of liggen in een comfortabele positie. Adem langzaam in door de neus terwijl je tot 4 telt. Houd de adem vast terwijl je tot 4 telt. Adem langzaam uit terwijl je tot 4 telt. Houd opnieuw vast terwijl je tot 4 telt. Herhaal dit ritme gedurende de hele sessie.',
    tips: [
      'Houd je schouders ontspannen',
      'Adem vanuit je buik, niet je borst',
      'Sluit je ogen als dat helpt',
      'Forceer het ritme niet — pas aan als nodig',
    ],
    fouten: [
      'Te snel ademen',
      'Schouders optrekken bij inademen',
      'Spanning vasthouden in het lichaam',
    ],
    primaireSpieren: [],
    secundaireSpieren: [],
    herstel: true,
    mobiliteit: false,
  },

  {
    id: 'childs-pose',
    naam: 'Child\'s Pose',
    categorie: 'Herstel',
    lichaamsdelen: ['rug', 'schouders'],
    coachDoelen: ['herstel', 'mobiliteit'],
    niveau: 'beginner',
    duur: 60,
    uitleg: 'Kniel op de grond, strek je armen vooruit en laat je voorhoofd zakken naar de mat. Houd de positie vast.',
    beschrijving: 'Begin op handen en knieën. Duw je heupen naar achteren richting je hielen terwijl je armen gestrekt naar voren blijven. Laat je voorhoofd rusten op de mat. Adem diep in en voel hoe je rug zich bij elke uitademing iets meer ontspant. Houd de positie comfortabel vast.',
    tips: [
      'Laat je schouders zakken bij elke uitademing',
      'Duw je heupen actief naar je hielen',
      'Spreid je knieën iets uit als je heupen strak zijn',
      'Adem diep en langzaam',
    ],
    fouten: [
      'Schouders optrekken naar de oren',
      'Heupen omhoog houden van de hielen',
      'Adem inhouden',
    ],
    primaireSpieren: ['Rugspieren', 'Latissimus dorsi'],
    secundaireSpieren: ['Schouders', 'Heupen'],
    herstel: true,
    mobiliteit: true,
  },

  {
    id: 'cat-cow',
    naam: 'Cat-Cow',
    categorie: 'Herstel',
    lichaamsdelen: ['rug', 'core'],
    coachDoelen: ['herstel', 'mobiliteit', 'warmup'],
    niveau: 'beginner',
    herhalingen: '10-15',
    uitleg: 'Op handen en knieën: wissel tussen rug hol trekken (Cow) en rug ronden (Cat). Langzaam en gecontroleerd.',
    beschrijving: 'Begin op handen en knieën met polsen onder schouders en knieën onder heupen. Cow: adem in, laat je buik zakken, til je hoofd en staartbeen omhoog. Cat: adem uit, rond je rug omhoog, trek je navel naar de wervelkolom en laat je hoofd zakken. Beweeg vloeiend tussen de twee posities.',
    tips: [
      'Beweeg langzaam en bewust',
      'Synchroniseer de beweging met je ademhaling',
      'Voel elke wervel individueel bewegen',
      'Houd je armen recht',
    ],
    fouten: [
      'Te snel bewegen',
      'Ellebogen buigen',
      'Ademhaling loskoppelen van de beweging',
    ],
    primaireSpieren: ['Rugspieren', 'Core'],
    secundaireSpieren: ['Nek', 'Schouders'],
    herstel: true,
    mobiliteit: true,
  },

  {
    id: 'thoracic-rotation',
    naam: 'Thoracale Rotatie',
    categorie: 'Herstel',
    lichaamsdelen: ['rug'],
    coachDoelen: ['herstel', 'mobiliteit'],
    niveau: 'beginner',
    herhalingen: '8-10 per kant',
    uitleg: 'Lig op je zij met knieën gebogen. Strek je bovenste arm voor je uit en roteer langzaam naar de andere kant. Volg met je blik.',
    beschrijving: 'Ga op je zij liggen met heupen en knieën gebogen in een hoek van 90 graden. Leg beide armen gestrekt voor je. Til je bovenste arm op en roteer langzaam je bovenlichaam terwijl je de arm naar de andere kant beweegt. Volg de beweging met je blik. Laat je knieën op de grond liggen. Keer terug naar de startpositie en herhaal.',
    tips: [
      'Houd je knieën op de grond tijdens de rotatie',
      'Beweeg langzaam en gecontroleerd',
      'Adem uit tijdens de rotatie',
      'Forceer het bereik niet',
    ],
    fouten: [
      'Knieën optillen van de grond',
      'Te snel draaien',
      'Schouder niet volledig laten zakken',
    ],
    primaireSpieren: ['Thoracale wervelkolom', 'Rugspieren'],
    secundaireSpieren: ['Schouders', 'Core'],
    herstel: true,
    mobiliteit: true,
  },

  {
    id: 'deep-squat-hold',
    naam: 'Deep Squat Hold',
    categorie: 'Herstel',
    lichaamsdelen: ['benen', 'bilspieren'],
    coachDoelen: ['herstel', 'mobiliteit'],
    niveau: 'beginner',
    duur: 60,
    uitleg: 'Sta met voeten op schouderbreedte. Zak zo diep mogelijk door de knieën en houd de positie vast. Gebruik een steun indien nodig.',
    beschrijving: 'Sta met voeten iets wijder dan schouderbreedte, tenen licht naar buiten gedraaid. Zak langzaam zo diep mogelijk door de knieën terwijl je borst rechtop blijft. Druk je knieën naar buiten met je ellebogen. Houd de positie vast. Als je hielen van de grond komen, sta dan een klein steuntje toe of rol een handdoek onder je hielen.',
    tips: [
      'Druk knieën naar buiten — gebruik ellebogen als hendel',
      'Borst rechtop houden',
      'Hielen op de grond houden',
      'Gebruik een steun als de positie te uitdagend is',
    ],
    fouten: [
      'Hielen van de grond',
      'Borst naar voren vallen',
      'Knieën naar binnen zakken',
    ],
    primaireSpieren: ['Heupen', 'Bilspieren', 'Quadriceps'],
    secundaireSpieren: ['Kuitspieren', 'Hamstrings'],
    herstel: true,
    mobiliteit: true,
  },

  // ── MOBILITEIT (5) ────────────────────────────────────────────────────────

  {
    id: 'worlds-greatest-stretch',
    naam: 'World\'s Greatest Stretch',
    categorie: 'Mobiliteit',
    lichaamsdelen: ['volledig'],
    coachDoelen: ['mobiliteit', 'warmup'],
    niveau: 'beginner',
    herhalingen: '5 per kant',
    uitleg: 'Stap groot naar voren in een lunge, plaats je hand naast je voorvoet, roteer je bovenlichaam en strek je arm omhoog. Houd even vast.',
    beschrijving: 'Begin staand. Stap groot naar voren met je rechtervoet in een lunge. Plaats je linkerhand op de grond naast je rechtervoet. Roteer je bovenlichaam naar rechts en strek je rechterarm omhoog naar het plafond. Volg met je blik. Houd 2-3 seconden vast, keer terug en herhaal aan de andere kant.',
    tips: [
      'Houd je voorste knie boven je enkel',
      'Beweeg langzaam en bewust',
      'Strek de arm volledig omhoog',
      'Laat je heup zakken in de lunge',
    ],
    fouten: [
      'Voorste knie naar binnen zakken',
      'Arm niet volledig strekken',
      'Te snel bewegen',
    ],
    primaireSpieren: ['Heupen', 'Borstkas', 'Thoracale wervelkolom'],
    secundaireSpieren: ['Schouders', 'Hamstrings', 'Core'],
    herstel: false,
    mobiliteit: true,
  },

  {
    id: '90-90-stretch',
    naam: '90/90 Stretch',
    categorie: 'Mobiliteit',
    lichaamsdelen: ['bilspieren', 'benen'],
    coachDoelen: ['mobiliteit', 'herstel'],
    niveau: 'beginner',
    duur: 60,
    uitleg: 'Zit op de grond met beide benen in een hoek van 90 graden — één been voor je, één been aan de zijkant. Leun licht naar voren over je voorste been.',
    beschrijving: 'Ga op de grond zitten. Buig je rechterbeeen voor je in een hoek van 90 graden (heup, knie en enkel allemaal op 90 graden). Buig je linker been naar de zijkant ook in een hoek van 90 graden. Blijf rechtop zitten of leun licht naar voren over je voorste been voor een diepere stretch. Houd de positie vast en wissel daarna van kant.',
    tips: [
      'Houd je rug recht',
      'Forceer de positie niet',
      'Adem diep in de stretch',
      'Begin met een kortere tijd als het oncomfortabel voelt',
    ],
    fouten: [
      'Rug bol trekken',
      'Te ver naar voren leunen',
      'Heup van de grond tillen',
    ],
    primaireSpieren: ['Piriformis', 'Bilspieren', 'Heupabductoren'],
    secundaireSpieren: ['Hamstrings', 'Heuprotatoren'],
    herstel: true,
    mobiliteit: true,
  },

  {
    id: 'hip-flexor-stretch',
    naam: 'Heupbuiger Stretch',
    categorie: 'Mobiliteit',
    lichaamsdelen: ['benen', 'bilspieren'],
    coachDoelen: ['mobiliteit', 'herstel', 'warmup'],
    niveau: 'beginner',
    duur: 45,
    uitleg: 'Kniel op één knie in een lunge-positie. Duw je heupen naar voren en omlaag. Houd de positie vast.',
    beschrijving: 'Kniel op je rechterknee met je linkervoet voor je op de grond in een lunge. Houd je romp rechtop. Duw je heupen langzaam naar voren en omlaag totdat je een stretch voelt aan de voorkant van je rechterdij. Houd de positie vast. Wissel daarna van kant.',
    tips: [
      'Houd je romp recht — niet naar voren leunen',
      'Span je bilspieren aan van het achterste been',
      'Duw actief naar voren, niet alleen zakken',
      'Adem diep in de stretch',
    ],
    fouten: [
      'Romp naar voren leunen',
      'Voorste knie over de teen laten komen',
      'Bilspieren niet aanspannen',
    ],
    primaireSpieren: ['Heupbuigers', 'Iliopsoas'],
    secundaireSpieren: ['Quadriceps', 'Bilspieren'],
    herstel: true,
    mobiliteit: true,
  },

  {
    id: 'shoulder-rolls',
    naam: 'Schouderrollen',
    categorie: 'Mobiliteit',
    lichaamsdelen: ['schouders', 'rug'],
    coachDoelen: ['mobiliteit', 'herstel', 'warmup'],
    niveau: 'beginner',
    herhalingen: '10 voor, 10 achter',
    uitleg: 'Rol je schouders langzaam naar voren en achteren in grote cirkels. Houd je armen ontspannen.',
    beschrijving: 'Sta of zit rechtop met armen ontspannen langs je lichaam. Rol beide schouders tegelijk langzaam naar voren in grote cirkels — omhoog, naar voren, omlaag, naar achteren. Doe 10 herhalingen. Keer daarna de richting om en doe 10 herhalingen naar achteren.',
    tips: [
      'Maak grote, langzame cirkels',
      'Houd je nek ontspannen',
      'Adem rustig door',
      'Voel waar de spanning zit',
    ],
    fouten: [
      'Te kleine bewegingen maken',
      'Nek mee laten bewegen',
      'Te snel draaien',
    ],
    primaireSpieren: ['Trapezius', 'Schouderbladen'],
    secundaireSpieren: ['Nek', 'Bovenrug'],
    herstel: true,
    mobiliteit: true,
  },

  {
    id: 'inchworm',
    naam: 'Inchworm',
    categorie: 'Mobiliteit',
    lichaamsdelen: ['volledig'],
    coachDoelen: ['mobiliteit', 'warmup'],
    niveau: 'beginner',
    herhalingen: '6-8',
    uitleg: 'Sta rechtop, buig naar voren, loop met je handen naar een plankpositie, loop terug en kom omhoog. Herhaal.',
    beschrijving: 'Sta rechtop met voeten op heupbreedte. Buig langzaam naar voren en raak de grond aan. Loop met je handen naar voren totdat je in een plankpositie bent. Houd kort vast. Loop dan met je voeten naar je handen. Kom langzaam omhoog en herhaal.',
    tips: [
      'Houd je benen zo recht mogelijk bij het naar voren buigen',
      'Beweeg langzaam en gecontroleerd',
      'Houd je core actief in de plankpositie',
      'Adem uit bij het naar voren lopen',
    ],
    fouten: [
      'Knieën te ver buigen',
      'Heupen te hoog in de plank',
      'Te snel bewegen',
    ],
    primaireSpieren: ['Hamstrings', 'Core', 'Schouders'],
    secundaireSpieren: ['Rugspieren', 'Borstkas'],
    herstel: false,
    mobiliteit: true,
  },

  // ── WARMUP (5) ────────────────────────────────────────────────────────────

  {
    id: 'jumping-jacks',
    naam: 'Jumping Jacks',
    categorie: 'Warmup',
    lichaamsdelen: ['volledig'],
    coachDoelen: ['warmup', 'conditie'],
    niveau: 'beginner',
    herhalingen: '20-30',
    uitleg: 'Spring met beide benen tegelijk naar buiten terwijl je armen omhoog gaan. Spring terug naar de startpositie. Herhaal in een regelmatig tempo.',
    beschrijving: 'Sta rechtop met voeten samen en armen langs je lichaam. Spring en beweeg je voeten naar buiten terwijl je armen zijwaarts omhoog gaan tot boven je hoofd. Spring terug naar de startpositie met voeten samen en armen omlaag. Herhaal in een consistent ritme.',
    tips: [
      'Land zacht op de ballen van je voeten',
      'Houd je knieën licht gebogen bij de landing',
      'Houd een regelmatig ritme',
      'Adem rustig door',
    ],
    fouten: [
      'Hard landen op je hielen',
      'Knieën naar binnen zakken',
      'Armen niet volledig strekken',
    ],
    primaireSpieren: ['Schouders', 'Heupen', 'Kuitspieren'],
    secundaireSpieren: ['Core', 'Quadriceps'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'arm-circles',
    naam: 'Armcirkels',
    categorie: 'Warmup',
    lichaamsdelen: ['schouders'],
    coachDoelen: ['warmup', 'mobiliteit'],
    niveau: 'beginner',
    herhalingen: '15 voor, 15 achter',
    uitleg: 'Strek beide armen zijwaarts en maak kleine tot grote cirkels. Wissel van richting.',
    beschrijving: 'Sta rechtop met voeten op heupbreedte. Strek beide armen horizontaal uit aan de zijkant. Begin met kleine cirkels naar voren en vergroot geleidelijk. Doe 15 herhalingen. Wissel daarna van richting voor nog 15 herhalingen.',
    tips: [
      'Houd je armen echt gestrekt',
      'Begin klein en vergroot de beweging',
      'Houd je schouders laag — niet optrekken',
      'Sta stabiel op beide voeten',
    ],
    fouten: [
      'Armen laten zakken',
      'Schouders optrekken',
      'Romp mee laten draaien',
    ],
    primaireSpieren: ['Schouders', 'Rotatorenmanchet'],
    secundaireSpieren: ['Trapezius', 'Bovenrug'],
    herstel: false,
    mobiliteit: true,
  },

  {
    id: 'air-squat',
    naam: 'Air Squat',
    categorie: 'Warmup',
    lichaamsdelen: ['benen', 'bilspieren'],
    coachDoelen: ['warmup', 'kracht'],
    niveau: 'beginner',
    herhalingen: '15-20',
    uitleg: 'Sta met voeten op schouderbreedte. Zak door de knieën totdat je dijen parallel zijn aan de grond. Drijf omhoog.',
    beschrijving: 'Sta met voeten op schouderbreedte, tenen licht naar buiten. Strek je armen voor je uit voor balans. Zak langzaam door de knieën terwijl je je borst omhoog houdt. Ga totdat je dijen parallel zijn aan de grond of dieper als mobiliteit het toelaat. Drijf omhoog via je hielen.',
    tips: [
      'Houd je borst omhoog en rug recht',
      'Knieën volgen de richting van de tenen',
      'Drijf omhoog via de hielen',
      'Houd je gewicht in het midden van je voeten',
    ],
    fouten: [
      'Borst naar voren vallen',
      'Knieën naar binnen zakken',
      'Hielen van de grond',
      'Onvoldoende diepte',
    ],
    primaireSpieren: ['Quadriceps', 'Bilspieren'],
    secundaireSpieren: ['Hamstrings', 'Kuitspieren', 'Core'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'walking-lunge',
    naam: 'Walking Lunge',
    categorie: 'Warmup',
    lichaamsdelen: ['benen', 'bilspieren'],
    coachDoelen: ['warmup', 'kracht'],
    niveau: 'beginner',
    herhalingen: '10 per been',
    uitleg: 'Stap groot naar voren en zak door je voorste knie. Kom omhoog en stap direct met het andere been naar voren.',
    beschrijving: 'Sta rechtop. Stap groot naar voren met je rechtervoet. Laat je linkerknee zakken naar de grond (maar raak de grond niet). Houd je romp rechtop. Kom omhoog en stap direct door met je linkervoet naar voren. Wissel zo afwisselend van been terwijl je vooruitloopt.',
    tips: [
      'Houd je romp rechtop — niet naar voren leunen',
      'Voorste knie boven de enkel houden',
      'Stap breed genoeg voor een goede range',
      'Land zacht op je voorste voet',
    ],
    fouten: [
      'Romp naar voren leunen',
      'Voorste knie over de teen',
      'Te kleine stappen',
      'Achterste knie hard op de grond',
    ],
    primaireSpieren: ['Quadriceps', 'Bilspieren', 'Hamstrings'],
    secundaireSpieren: ['Core', 'Kuitspieren'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'high-knees',
    naam: 'High Knees',
    categorie: 'Warmup',
    lichaamsdelen: ['benen', 'core'],
    coachDoelen: ['warmup', 'conditie'],
    niveau: 'beginner',
    duur: 30,
    uitleg: 'Loop op de plaats en breng je knieën zo hoog mogelijk terwijl je je armen mee swingt. Houd een snel tempo.',
    beschrijving: 'Sta rechtop. Begin te lopen op de plaats terwijl je je knieën abwisselend zo hoog mogelijk optilt — idealiter tot heupniveau. Swing je armen mee als bij het lopen. Houd een snel en consistent tempo gedurende de hele set.',
    tips: [
      'Til je knieën echt tot heupniveau',
      'Land op de bal van je voet',
      'Houd je romp rechtop',
      'Swing je armen actief mee',
    ],
    fouten: [
      'Knieën niet hoog genoeg brengen',
      'Landen op de hiel',
      'Romp naar voren leunen',
      'Armen niet meebewegen',
    ],
    primaireSpieren: ['Heupbuigers', 'Quadriceps', 'Kuitspieren'],
    secundaireSpieren: ['Core', 'Schouders'],
    herstel: false,
    mobiliteit: false,
  },

  // ── KRACHT (10) ───────────────────────────────────────────────────────────

  {
    id: 'push-up',
    naam: 'Push-Up',
    categorie: 'Kracht',
    lichaamsdelen: ['borst', 'schouders'],
    coachDoelen: ['kracht'],
    niveau: 'beginner',
    herhalingen: '8-15',
    uitleg: 'Begin in plankpositie. Laat je lichaam zakken totdat je borst de grond bijna raakt. Druk omhoog. Houd je lichaam recht als een plank.',
    beschrijving: 'Begin in een hoge plankpositie met handen iets breder dan schouderbreedte. Houd je lichaam in een rechte lijn van hoofd tot hielen. Buig je ellebogen en laat je lichaam zakken totdat je borst de grond bijna raakt. Druk krachtig omhoog naar de startpositie.',
    tips: [
      'Houd je lichaam recht als een plank — geen hangende heupen',
      'Ellebogen op 45 graden ten opzichte van je lichaam',
      'Volledige range — borst bijna de grond',
      'Span je core en billen aan voor stabiliteit',
    ],
    fouten: [
      'Heupen omhoog of omlaag hangen',
      'Ellebogen te wijd — richting 90 graden',
      'Onvoldoende diepte',
      'Hoofd naar voren steken',
    ],
    primaireSpieren: ['Borstspieren', 'Triceps'],
    secundaireSpieren: ['Schouders', 'Core'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'incline-push-up',
    naam: 'Incline Push-Up',
    categorie: 'Kracht',
    lichaamsdelen: ['borst', 'schouders'],
    coachDoelen: ['kracht', 'herstel'],
    niveau: 'beginner',
    herhalingen: '10-15',
    uitleg: 'Zelfde als een push-up maar met je handen op een verhoogd oppervlak (bank, muur). Makkelijker dan een gewone push-up.',
    beschrijving: 'Plaats je handen op een verhoogd oppervlak zoals een bank of stevig tafel, iets breder dan schouderbreedte. Houd je lichaam in een rechte lijn. Buig je ellebogen en laat je borst zakken naar het oppervlak. Druk omhoog. Hoe hoger het oppervlak, hoe makkelijker de oefening.',
    tips: [
      'Houd je lichaam recht — geen hangende heupen',
      'Borst raakt het oppervlak aan onderaan',
      'Ellebogen op 45 graden',
      'Span je core aan',
    ],
    fouten: [
      'Heupen zakken',
      'Ellebogen te wijd',
      'Onvoldoende diepte',
    ],
    primaireSpieren: ['Borstspieren', 'Triceps'],
    secundaireSpieren: ['Schouders', 'Core'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'pike-push-up',
    naam: 'Pike Push-Up',
    categorie: 'Kracht',
    lichaamsdelen: ['schouders'],
    coachDoelen: ['kracht'],
    niveau: 'gemiddeld',
    herhalingen: '8-12',
    uitleg: 'Begin in een omgekeerde V-positie (heupen hoog). Buig je ellebogen en laat je hoofd zakken naar de grond. Druk omhoog.',
    beschrijving: 'Begin in een plankpositie. Duw je heupen omhoog totdat je lichaam een omgekeerde V vormt met je hoofd tussen je armen. Buig je ellebogen en laat je hoofd zakken richting de grond tussen je handen. Druk krachtig omhoog. Dit traint primair je schouders.',
    tips: [
      'Houd je benen zo recht mogelijk',
      'Beweeg je hoofd recht omlaag — niet naar voren',
      'Heupen hoog houden tijdens de hele beweging',
      'Ellebogen richten naar buiten',
    ],
    fouten: [
      'Heupen zakken tijdens de beweging',
      'Hoofd naar voren steken',
      'Onvoldoende diepte',
    ],
    primaireSpieren: ['Schouders', 'Triceps'],
    secundaireSpieren: ['Borstspieren', 'Core'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'split-squat',
    naam: 'Split Squat',
    categorie: 'Kracht',
    lichaamsdelen: ['benen', 'bilspieren'],
    coachDoelen: ['kracht'],
    niveau: 'beginner',
    herhalingen: '10 per been',
    uitleg: 'Sta in een gesplitste positie met één voet voor en één achter. Zak recht omlaag en omhoog zonder je voeten te verplaatsen.',
    beschrijving: 'Stap met je rechtervoet groot naar voren en houd je linkervoet achter je. Houd beide voeten in deze positie. Laat je lichaam recht omlaag zakken — je voorste knie buigt, je achterste knie daalt richting de grond. Drijf omhoog. Doe alle herhalingen op één been voor je wisselt.',
    tips: [
      'Houd je romp recht — niet naar voren leunen',
      'Voorste knie boven de enkel',
      'Zak recht omlaag — niet naar voren',
      'Bilspieren aanspannen bij het omhoog komen',
    ],
    fouten: [
      'Voorste knie over de teen',
      'Romp naar voren leunen',
      'Schouders optrekken',
    ],
    primaireSpieren: ['Quadriceps', 'Bilspieren'],
    secundaireSpieren: ['Hamstrings', 'Core', 'Kuitspieren'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'reverse-lunge',
    naam: 'Reverse Lunge',
    categorie: 'Kracht',
    lichaamsdelen: ['benen', 'bilspieren'],
    coachDoelen: ['kracht', 'warmup'],
    niveau: 'beginner',
    herhalingen: '10 per been',
    uitleg: 'Stap achterwaarts in een lunge. Laat je achterste knie zakken naar de grond. Kom omhoog en breng je been terug.',
    beschrijving: 'Sta rechtop. Stap achterwaarts met je rechtervoet en laat je rechterknee zakken naar de grond. Houd je voorste knie boven je enkel. Je romp blijft rechtop. Drijf omhoog via je voorste been en breng je rechtervoet terug naar de startpositie. Wissel van been.',
    tips: [
      'Stap recht achterwaarts — niet naar de zijkant',
      'Voorste knie boven de enkel',
      'Houd je romp recht',
      'Land zacht op de bal van je achterste voet',
    ],
    fouten: [
      'Romp naar voren leunen',
      'Voorste knie over de teen',
      'Achterste knie hard op de grond',
    ],
    primaireSpieren: ['Quadriceps', 'Bilspieren'],
    secundaireSpieren: ['Hamstrings', 'Core', 'Kuitspieren'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'glute-bridge',
    naam: 'Glute Bridge',
    categorie: 'Kracht',
    lichaamsdelen: ['bilspieren', 'benen'],
    coachDoelen: ['kracht', 'herstel'],
    niveau: 'beginner',
    herhalingen: '15-20',
    uitleg: 'Lig op je rug met knieën gebogen. Duw je heupen omhoog terwijl je je bilspieren aanspant. Houd even vast en laat zakken.',
    beschrijving: 'Lig op je rug met knieën gebogen en voeten plat op de grond, heupbreedte uit elkaar. Armen langs je lichaam. Span je bilspieren aan en duw je heupen omhoog totdat je lichaam een rechte lijn vormt van schouders tot knieën. Houd 1-2 seconden vast bovenin. Laat langzaam zakken.',
    tips: [
      'Span je bilspieren écht aan bovenin',
      'Duw via je hielen omhoog',
      'Houd je core actief — rug niet hol trekken',
      'Laat langzaam zakken — houd controle',
    ],
    fouten: [
      'Rug hol trekken bovenin',
      'Knieën naar binnen of buiten zakken',
      'Te snel zakken',
      'Bilspieren niet aanspannen',
    ],
    primaireSpieren: ['Bilspieren', 'Hamstrings'],
    secundaireSpieren: ['Core', 'Rugspieren'],
    herstel: true,
    mobiliteit: false,
  },

  {
    id: 'superman',
    naam: 'Superman',
    categorie: 'Kracht',
    lichaamsdelen: ['rug'],
    coachDoelen: ['kracht', 'herstel'],
    niveau: 'beginner',
    herhalingen: '12-15',
    uitleg: 'Lig op je buik met armen gestrekt voor je. Til tegelijk je armen en benen van de grond. Houd even vast en laat zakken.',
    beschrijving: 'Lig op je buik met armen gestrekt voor je en benen gestrekt achter je. Span je rug- en bilspieren aan en til tegelijk je armen en benen van de grond — alsof je vliegt. Houd 2-3 seconden vast. Laat langzaam zakken en herhaal.',
    tips: [
      'Til armen en benen gelijktijdig op',
      'Houd je hoofd in lijn met je wervelkolom — niet te ver omhoog',
      'Span je bilspieren aan bij het optillen',
      'Beweeg gecontroleerd — geen schokken',
    ],
    fouten: [
      'Hoofd te ver achterover',
      'Armen en benen niet gelijktijdig',
      'Schokkerige beweging',
    ],
    primaireSpieren: ['Rugspieren', 'Erector spinae'],
    secundaireSpieren: ['Bilspieren', 'Hamstrings', 'Schouders'],
    herstel: true,
    mobiliteit: false,
  },

  {
    id: 'step-up',
    naam: 'Step-Up',
    categorie: 'Kracht',
    lichaamsdelen: ['benen', 'bilspieren'],
    coachDoelen: ['kracht', 'conditie'],
    niveau: 'beginner',
    herhalingen: '10 per been',
    uitleg: 'Stap met één voet op een verhoging (bank, trap). Duw jezelf omhoog. Stap terug en herhaal.',
    beschrijving: 'Sta voor een verhoging van 30-50 cm (bank, stevige stoel, trap). Zet je rechtervoet volledig op de verhoging. Duw jezelf omhoog via je rechtervoet totdat je staat. Stap terug met je rechtervoet als eerste. Doe alle herhalingen op één been voor je wisselt.',
    tips: [
      'Duw omhoog via je voorste been — niet afzetten met je achterste',
      'Zet je voet volledig op de verhoging',
      'Houd je romp rechtop',
      'Stap gecontroleerd terug',
    ],
    fouten: [
      'Afzetten met het achterste been',
      'Romp naar voren leunen',
      'Knie naar binnen zakken',
    ],
    primaireSpieren: ['Quadriceps', 'Bilspieren'],
    secundaireSpieren: ['Hamstrings', 'Core', 'Kuitspieren'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'calf-raise',
    naam: 'Kuitverheffen',
    categorie: 'Kracht',
    lichaamsdelen: ['benen'],
    coachDoelen: ['kracht', 'warmup'],
    niveau: 'beginner',
    herhalingen: '20-25',
    uitleg: 'Sta met voeten op heupbreedte. Kom op de ballen van je voeten omhoog. Laat langzaam zakken.',
    beschrijving: 'Sta rechtop met voeten op heupbreedte. Gebruik een muur of leuning voor balans indien nodig. Kom langzaam op de ballen van je voeten omhoog — zo hoog mogelijk. Houd 1 seconde vast bovenin. Laat langzaam zakken totdat je hielen bijna de grond raken.',
    tips: [
      'Ga zo hoog mogelijk op je ballen',
      'Beweeg langzaam — focus op controle',
      'Houd je knieën licht gebogen — niet op slot',
      'Beide voeten gelijk belasten',
    ],
    fouten: [
      'Te snel zakken',
      'Niet hoog genoeg komen',
      'Gewicht naar één kant verschuiven',
    ],
    primaireSpieren: ['Kuitspieren', 'Gastrocnemius'],
    secundaireSpieren: ['Soleus', 'Enkels'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'wall-sit',
    naam: 'Wall Sit',
    categorie: 'Kracht',
    lichaamsdelen: ['benen'],
    coachDoelen: ['kracht'],
    niveau: 'beginner',
    duur: 45,
    uitleg: 'Leun met je rug tegen een muur en zak door je knieën tot 90 graden. Houd de positie vast.',
    beschrijving: 'Leun met je rug plat tegen een muur. Schuif naar beneden totdat je knieën in een hoek van 90 graden zijn — alsof je op een onzichtbare stoel zit. Voeten op schouderbreedte, recht voor je. Houd de positie vast gedurende de ingestelde tijd.',
    tips: [
      'Houd je rug plat tegen de muur',
      'Knieën boven je enkels — niet verder naar voren',
      'Dijen parallel aan de grond',
      'Adem rustig door',
    ],
    fouten: [
      'Rug van de muur halen',
      'Knieën over de tenen',
      'Dijen niet parallel',
    ],
    primaireSpieren: ['Quadriceps'],
    secundaireSpieren: ['Bilspieren', 'Hamstrings', 'Kuitspieren'],
    herstel: false,
    mobiliteit: false,
  },

  // ── CORE (5) ──────────────────────────────────────────────────────────────

  {
    id: 'plank',
    naam: 'Plank',
    categorie: 'Core',
    lichaamsdelen: ['core'],
    coachDoelen: ['core', 'kracht'],
    niveau: 'beginner',
    duur: 30,
    uitleg: 'Houd een plankpositie op handen of onderarmen. Lichaam recht als een plank. Core actief.',
    beschrijving: 'Begin op handen en knieën. Strek je benen achter je uit zodat je op je handen en teentoppen rust. Houd je lichaam in een rechte lijn van hoofd tot hielen. Span je core aan, knijp je bilspieren en houd je heupen in lijn. Adem rustig door.',
    tips: [
      'Houd je heupen in lijn — niet omhoog of omlaag',
      'Span je core actief aan',
      'Kijk naar de grond — hoofd in lijn met ruggengraat',
      'Adem rustig en gecontroleerd',
    ],
    fouten: [
      'Heupen omhoog steken',
      'Heupen naar de grond zakken',
      'Hoofd omhoog steken',
      'Adem inhouden',
    ],
    primaireSpieren: ['Core', 'Transversus abdominis'],
    secundaireSpieren: ['Schouders', 'Bilspieren', 'Rugspieren'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'side-plank',
    naam: 'Zijplank',
    categorie: 'Core',
    lichaamsdelen: ['core'],
    coachDoelen: ['core', 'kracht'],
    niveau: 'beginner',
    duur: 20,
    uitleg: 'Lig op je zij op je onderarm. Til je heupen op zodat je lichaam een rechte lijn vormt. Houd vast.',
    beschrijving: 'Lig op je rechterzij met je rechteronderarm op de grond, elleboog onder je schouder. Stapel je voeten op elkaar of zet ze voor/achter elkaar. Til je heupen op zodat je lichaam een rechte diagonale lijn vormt. Houd de positie vast. Wissel daarna van kant.',
    tips: [
      'Elleboog direct onder de schouder',
      'Houd je heupen omhoog — niet laten zakken',
      'Houd je lichaam in één rechte lijn',
      'Span je core aan',
    ],
    fouten: [
      'Heupen zakken',
      'Heup naar voren of achteren roteren',
      'Elleboog niet onder schouder',
    ],
    primaireSpieren: ['Obliques', 'Core'],
    secundaireSpieren: ['Schouders', 'Bilspieren'],
    herstel: false,
    mobiliteit: false,
  },

  {
    id: 'dead-bug',
    naam: 'Dead Bug',
    categorie: 'Core',
    lichaamsdelen: ['core'],
    coachDoelen: ['core', 'herstel'],
    niveau: 'beginner',
    herhalingen: '8-10 per kant',
    uitleg: 'Lig op je rug met armen omhoog en knieën gebogen. Strek tegelijk de tegenovergestelde arm en het been terwijl je je rug plat houdt.',
    beschrijving: 'Lig op je rug met armen gestrekt omhoog en benen omhoog gebogen in een hoek van 90 graden. Druk je onderrug in de mat. Strek langzaam tegelijk je rechterarm achter je hoofd en je linkerbeen naar voren — zonder je rug van de mat te laten komen. Kom terug en wissel.',
    tips: [
      'Houd je onderrug plat op de mat gedurende de hele beweging',
      'Beweeg langzaam en gecontroleerd',
      'Adem uit bij het strekken',
      'Strek volledig — arm en been volledig gestrekt',
    ],
    fouten: [
      'Onderrug van de mat laten komen',
      'Te snel bewegen',
      'Niet volledig strekken',
    ],
    primaireSpieren: ['Core', 'Transversus abdominis'],
    secundaireSpieren: ['Heupbuigers', 'Schouders'],
    herstel: true,
    mobiliteit: false,
  },

  {
    id: 'bird-dog',
    naam: 'Bird Dog',
    categorie: 'Core',
    lichaamsdelen: ['core', 'rug'],
    coachDoelen: ['core', 'herstel'],
    niveau: 'beginner',
    herhalingen: '8-10 per kant',
    uitleg: 'Op handen en knieën: strek tegelijk de tegenovergestelde arm en het been. Houd even vast. Houd je rug recht.',
    beschrijving: 'Begin op handen en knieën met polsen onder schouders en knieën onder heupen. Span je core aan. Strek langzaam tegelijk je rechterarm naar voren en je linkerbeen naar achteren — houd ze parallel aan de grond. Houd 2-3 seconden vast. Breng terug en wissel.',
    tips: [
      'Houd je rug recht — niet laten zakken of ronden',
      'Arm en been op gelijke hoogte — parallel aan de grond',
      'Houd je heupen in lijn — niet roteren',
      'Beweeg langzaam en gecontroleerd',
    ],
    fouten: [
      'Rug hol trekken',
      'Heupen naar één kant roteren',
      'Arm of been te hoog heffen',
    ],
    primaireSpieren: ['Core', 'Rugspieren'],
    secundaireSpieren: ['Bilspieren', 'Schouders', 'Hamstrings'],
    herstel: true,
    mobiliteit: false,
  },

  {
    id: 'mountain-climber',
    naam: 'Mountain Climber',
    categorie: 'Core',
    lichaamsdelen: ['core', 'benen'],
    coachDoelen: ['core', 'conditie', 'warmup'],
    niveau: 'beginner',
    duur: 30,
    uitleg: 'Begin in plankpositie. Breng afwisselend je knieën snel naar je borst. Houd je heupen laag.',
    beschrijving: 'Begin in een hoge plankpositie met handen onder je schouders. Span je core aan. Breng je rechterknee snel naar je borst terwijl je linkervoet op de grond blijft. Wissel snel van been. Houd een hoog tempo terwijl je je heupen laag en stabiel houdt.',
    tips: [
      'Houd je heupen laag — niet omhoog steken',
      'Handen stevig op de grond',
      'Span je core actief aan',
      'Houd een consistent hoog tempo',
    ],
    fouten: [
      'Heupen omhoog steken',
      'Armen buigen',
      'Rug hol trekken',
    ],
    primaireSpieren: ['Core', 'Heupbuigers'],
    secundaireSpieren: ['Schouders', 'Quadriceps', 'Borst'],
    herstel: false,
    mobiliteit: false,
  },
]

// ── Hulpfuncties voor de route ─────────────────────────────────────────────

/**
 * Filtert oefeningen op coachDoel.
 * Wordt gebruikt in training/today/route.ts om de juiste
 * oefeningen aan Trainer AI door te geven.
 */
export function filterOpCoachDoel(doel: CoachDoel): BodyweightOefening[] {
  return BODYWEIGHT_OEFENINGEN.filter(o => o.coachDoelen.includes(doel))
}

/**
 * Filtert oefeningen op niveau.
 */
export function filterOpNiveau(niveau: Niveau): BodyweightOefening[] {
  return BODYWEIGHT_OEFENINGEN.filter(o => o.niveau === niveau)
}

/**
 * Filtert oefeningen op lichaamsdeel.
 */
export function filterOpLichaamsdeel(deel: Lichaamsdeel): BodyweightOefening[] {
  return BODYWEIGHT_OEFENINGEN.filter(o => o.lichaamsdelen.includes(deel))
}

/**
 * Geeft een korte prompt-vriendelijke lijst van oefeningen terug.
 * Wordt direct in de Trainer AI prompt geplakt.
 */
export function formateerVoorPrompt(oefeningen: BodyweightOefening[]): string {
  return oefeningen.map(o =>
    `- ${o.naam} (${o.niveau}, ${o.lichaamsdelen.join('/')}): ${o.uitleg}`
  ).join('\n')
}
