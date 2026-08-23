# Block A/B — Bronnotitie (v2.4.356)

**Besluit:** Block A/B wordt behandeld als een **sterk onderbouwde, maar
niet officieel geverifieerde** dimensie. `bell_weight_kg` blijft `NULL`
op alle 720 classificatierijen. `source_status = 'strongly_indicated'`.

## Werkhypothese
Block A = zwaarste kettlebellgewicht binnen de betreffende
rankingconfiguratie. Block B = lichter kettlebellgewicht. **Dit is geen
bevestigd WKSF-feit.**

## Onderbouwing (vijf punten, geen enkele op zichzelf doorslaggevend)

1. **WKSF Rules 2023-2027, §2.1** — toegestane kettlebellgewichten per
   categorie zijn al bekend (bijv. Senior Men: 32kg of 24kg — twee
   opties, wat overeenkomt met twee blokken).
2. **Structuurpatroon in de rankingtabellen zelf:** Block A bevat
   MSEC/MS/CMS/Rank1/2/3 (6 niveaus), Block B bevat alleen CMS/Rank1/2/3
   (4 niveaus, geen MSEC/MS). Dit patroon is consistent over alle ~30
   tabellen.
3. **Secundaire analyse (kettlebell.university)**, die het gedeelde
   WKSF/IUKL/GSU-ranksysteem beschrijft: topranken (MSIC/MS/CMS) zijn
   alleen haalbaar met het zwaarste gewicht; het op één na zwaarste
   gewicht ontsluit CMS/Rank1/Rank2 — met CMS expliciet genoemd als
   haalbaar bij beide gewichten. Dit verklaart exact waarom Block B geen
   MSEC/MS heeft.
4. **Cijferpatroon in de eigen, al geïmporteerde 720 primaire
   WKSF-rijen:** Block B's hoogste trede (CMS) vereist consistent
   ietsiets meer reps dan Block A's hoogste trede (MSEC) — bijv. Long
   Cycle 10' Men 63kg: A-MSEC=54, B-CMS=58. Dit past bij een lichter
   gewicht dat meer herhalingen vereist voor een vergelijkbaar
   prestatieniveau. Bij een Elite/Amateur-verklaring zou het omgekeerde
   patroon verwacht worden (Amateur lager, niet hoger, dan Elite's top).
5. **Open, niet-opgelost punt:** Senior Women hebben volgens de Rules
   drie toegestane gewichten (24/20/16kg), niet twee. Een systeem met
   precies twee blokken kan dit niet 1-op-1 verklaren. Dit voorkomt een
   definitieve bevestiging.

## Wat NIET is gedaan
- Geen `bell_weight_kg` ingevuld (blijft `NULL` op alle 720 rijen)
- Geen A=32kg/B=24kg hardgecodeerd
- Geen koppeling aan Elite/Amateur gelegd (alternatieve hypothese,
  minder sterk onderbouwd dan de gewicht-hypothese, maar niet
  uitgesloten)
- Geen van de 720 classificatierijen gewijzigd

## Alternatieve hypothese (minder sterk, niet uitgesloten)
Block A = Elite, Block B = Amateur/Master. Ondersteund door: bevestigde
aparte "ELITE Classic 10'-12' Coefficient" en "AMATEUR-MASTER Classic
10'-12' Coefficient"-documenten op `wksf.site/allregulations/`, en
bevestiging dat "Amateur" een echte, aparte wedstrijdcategorie is
(`wksf.site/classic-10/`: "Only Snatch — only at Amateur Category").
**Minder sterk** omdat het cijferpatroon (punt 4 hierboven) beter past
bij een gewicht- dan een niveauverklaring.

## Volgende stap om dit definitief op te lossen
Een primaire WKSF-bron die expliciet stelt welk kettlebellgewicht bij
welk blok hoort (bijv. een legenda op de originele rankingafbeelding die
niet zichtbaar was in de aangeleverde screenshots, of het "AMATEUR-MASTER
Coefficient"-document zelf, indien toegankelijk).
