# Bron: WKSF Rules English 2023-2027 (Updated)

**Canonieke, officiële URL** (gecontroleerd tegen de live WKSF-site,
22 augustus 2026):
https://wksf.site/wp-content/uploads/2025/02/WKSF-Rules-English-2023-2027-UPDATE.pdf

- Goedgekeurd door WKSF Executive Committee: 21 maart 2023
- Update goedgekeurd: 31 december 2024
- WKSF President: Oleh Ilika

## Waarom dit bestand hier staat i.p.v. de PDF zelf
Het originele PDF-document is auteursrechtelijk beschermd materiaal van
WKSF. In plaats van een kopie in deze repo te zetten (bloat, kan
stilzwijgend verouderen als WKSF het brondocument bijwerkt), verwijzen we
naar de canonieke URL en leggen we vast wélke database-rijen op welke
sectie zijn gebaseerd — zie `supabase/kettlebell_wksf_rules_2023_2027_import.sql`.

## Wat uit dit document is verwerkt (Fase MVP2, stap 1)
- `kettlebell_rulebooks` — status `active`, brondocument-URL, datums
- `kettlebell_rulebook_disciplines` — Jerk/Long Cycle/Snatch/Biathlon/
  Relay Race, met wedstrijdduur en sectieverwijzing (§1.4, §11.x)
- `kettlebell_categories` — 18 leeftijds-/niveaucategorieën met officieel
  voorgeschreven kettlebellgewicht (§2.1) — **eligibility-info, geen
  classificatienorm**
- `kettlebell_judging_rules` — DO NOT COUNT/STOP-regels per discipline,
  uitrusting/kledingregels (§5.1, §7.2, §11.9-11.16)

## Wat NIET uit dit document komt (en dus nog leeg is)
`kettlebell_classifications` blijft leeg. Dit document bevat de
wedstrijd**procedure**, niet de officiële classificatie-/ranktabellen
(Rank III/II/I, CMS, MS, MSIC — vereiste reps per discipline, gewicht en
lichaamsgewichtklasse). Het document verwijst zelf (§13.2) naar een apart
"regulations about registration of records and the maximum achievements"-
document. De publieke WKSF-ranking-pagina (wksf.site/rankings/) bevestigt
dat zo'n apart rankingdocument bestaat, maar is niet automatisch op te
halen (robots.txt blokkeert geautomatiseerde toegang) — vereist
handmatige aanlevering, net als dit document.

**Volgende stap voor een volledige Classification Engine:** het officiële
WKSF-rankingdocument (Rank/CMS/MS/MSIC-tabellen) aanleveren.
