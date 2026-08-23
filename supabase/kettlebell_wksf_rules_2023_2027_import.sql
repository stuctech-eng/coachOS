-- ============================================================
-- CoachOS Kettlebell Specialist — WKSF Rules English 2023-2027 import
--
-- Bron: officieel WKSF-document, door de gebruiker aangeleverd en door
-- mij gecontroleerd tegen de live WKSF-site (wksf.site). Canonieke URL:
-- https://wksf.site/wp-content/uploads/2025/02/WKSF-Rules-English-2023-2027-UPDATE.pdf
-- Goedgekeurd door WKSF Executive Committee: 21 maart 2023.
-- Laatste update volgens het document zelf: 31 december 2024.
--
-- BELANGRIJKE, EXPLICIETE BEPERKING (niet gokken, dus hardop benoemen):
-- Dit document bevat de wedstrijd-PROCEDURE (categorieën, leeftijden,
-- kettlebellgewichten per categorie, uitrusting, jury/judging, no-count-
-- regels, scoringstabel, records-registratieprocedure). Het bevat GEEN
-- classificatie-/ranktabellen (bijv. "Rank III/II/I, CMS, MS, MSIC" met
-- vereiste reps per discipline/gewicht/lichaamsgewichtklasse). Die staan
-- in een apart, officieel WKSF-rankingdocument (wksf.site/rankings/ —
-- door robots.txt niet automatisch op te halen, vereist handmatige
-- aanlevering net als dit document). kettlebell_classifications blijft
-- daarom LEEG in dit bestand — zie ook §13.2 van het brondocument zelf,
-- die verwijst naar een apart "regulations about registration of
-- records and the maximum achievements"-document.
-- ============================================================

-- ── 1. Rulebook activeren ────────────────────────────────────
update kettlebell_rulebooks
set status = 'active',
    source_document = 'https://wksf.site/wp-content/uploads/2025/02/WKSF-Rules-English-2023-2027-UPDATE.pdf',
    published_at = '2023-03-21',
    effective_from = '2023-03-21'
where federation_id = (select id from kettlebell_federations where slug = 'wksf')
  and version = '2023-2027';

-- ── 2. Disciplines (§1.4, §1.2) ──────────────────────────────
-- competition_duration_sec = de klassieke 10-minutenvorm (§1.3/§11.3),
-- die ook exact aansluit op de vier disciplines in kettlebell_gs_sessions.
-- §1.2 noemt daarnaast ook 3/5/12-minutenchallenges en marathonvarianten
-- (30 min/1u/3u) — dat zijn aparte wedstrijdformaten, nog niet als losse
-- rijen gemodelleerd (schema kent nu één duur per discipline+rulebook).
-- Bewust benoemd i.p.v. stilzwijgend genegeerd — uitbreiding volgt zodra
-- competitie-/marathonformaten zelf gebouwd worden (MVP2, Competition
-- Engine).

insert into kettlebell_rulebook_disciplines (rulebook_id, discipline, competition_duration_sec, source_reference, notes)
select r.id, d.discipline, d.duration_sec, d.source_ref, d.notes
from kettlebell_rulebooks r
cross join (values
  ('jerk',       600, '§1.4, §11.9',  'Eén of twee armen, rack position naar lockout en terug naar rack. Zie ook §11.9-11.11 voor DO NOT COUNT/STOP-regels.'),
  ('long_cycle', 600, '§1.4, §11.12', 'Clean and Jerk: rack naar lockout naar rack, met de kettlebell(s) tussen de benen (dead point) na elke rise. Zie §11.12-11.13.'),
  ('snatch',     600, '§1.4, §11.14', 'Eén arm, ononderbroken van tussen de benen naar boven het hoofd. Eén handwissel toegestaan. Zie §11.14-11.16.'),
  ('biathlon',   600, '§1.4, §1.6',   'Jerk + Snatch. Eindscore = jerk-reps × 1 + snatch-reps × 0,5. Als jerk-score 0 is, telt de snatch-score niet mee.')
) as d(discipline, duration_sec, source_ref, notes)
where r.federation_id = (select id from kettlebell_federations where slug = 'wksf')
  and r.version = '2023-2027'
on conflict (rulebook_id, discipline) do update
  set competition_duration_sec = excluded.competition_duration_sec,
      source_reference = excluded.source_reference,
      notes = excluded.notes;

-- Relay Race apart: team-discipline, geen individuele 10-minutenduur.
insert into kettlebell_rulebook_disciplines (rulebook_id, discipline, competition_duration_sec, source_reference, notes)
select r.id, 'relay_race', null, '§1.4, §11.18-11.21',
  'Teamchallenge (Jerk + Long Cycle). Duur/gewicht/aantal stages per wedstrijdreglement, geen vaste 10 minuten — zie §11.18.'
from kettlebell_rulebooks r
where r.federation_id = (select id from kettlebell_federations where slug = 'wksf')
  and r.version = '2023-2027'
on conflict (rulebook_id, discipline) do nothing;

-- ── 3. Leeftijds-/niveaucategorieën + officiële bell weight-toewijzing (§2.1) ──
-- Kettlebellgewicht per categorie is procedurele eligibility-info (welk
-- gewicht in welke categorie verplicht is), GEEN classificatienorm —
-- vandaar wel hier, niet in kettlebell_classifications.

alter table kettlebell_categories add column if not exists official_bell_weights_kg text;

insert into kettlebell_categories (rulebook_id, name, min_age, max_age, source_reference, official_bell_weights_kg)
select r.id, c.name, c.min_age, c.max_age, '§2.1', c.bells
from kettlebell_rulebooks r
cross join (values
  ('Senior Men',        23, null, '32, 24'),
  ('Senior Women',      23, null, '24, 20, 16'),
  ('Master Men 40-59',  40, 59,   '24'),
  ('Master Men 60-74',  60, 74,   '16'),
  ('Master Men 75+',    75, null, '12'),
  ('Master Women 35-54',35, 54,   '16'),
  ('Master Women 55-64',55, 64,   '12'),
  ('Master Women 65+',  65, null, '8'),
  ('Junior U22 Men',    19, 22,   '32'),
  ('Junior U22 Women',  19, 22,   '20'),
  ('Young U18 Men',     16, 18,   '24'),
  ('Young U18 Women',   16, 18,   '16'),
  ('Children U15 Men',  14, 15,   '16'),
  ('Children U15 Women',14, 15,   '12'),
  ('Disable Men',       null, null, '16'),
  ('Disable Women',     null, null, '8'),
  ('Students Men',      null, null, '24'),
  ('Students Women',    null, null, '16')
) as c(name, min_age, max_age, bells)
where r.federation_id = (select id from kettlebell_federations where slug = 'wksf')
  and r.version = '2023-2027'
on conflict (rulebook_id, name) do update
  set min_age = excluded.min_age, max_age = excluded.max_age,
      official_bell_weights_kg = excluded.official_bell_weights_kg;

comment on column kettlebell_categories.official_bell_weights_kg is
  'Officieel voorgeschreven kettlebellgewicht(en) voor deze categorie (§2.1 WKSF) — eligibility, GEEN classificatienorm/reps-eis.';

-- ── 4. Judging: DO NOT COUNT / STOP-regels (§11.9-11.16) ────
-- Paraphrase van de brontekst (geen letterlijke overname), met
-- sectieverwijzing voor herleidbaarheid.

insert into kettlebell_judging_rules (rulebook_id, discipline, rule_type, description, source_reference)
select r.id, j.discipline, j.rule_type, j.description, j.source_ref
from kettlebell_rulebooks r
cross join (values
  ('jerk',       'no_count', 'Beweging met onderbreking, ongelijktijdig aanzetten van de kettlebells, ontbrekende technische stop in rackpositie, ontbrekende fixatie boven het hoofd, of uitvoering als press/push-press.', '§11.11'),
  ('jerk',       'fixation', 'Fixatie boven het hoofd moet duidelijk zichtbaar stilstaan (armen, romp, benen gestrekt); bij beperkte gewrichtsmobiliteit moet de fixatie extra visueel duidelijk zijn.', '§11.9'),
  ('jerk',       'other',    'STOP wanneer de kettlebell(s) op de schouders rusten (behalve bij de start), onder heuphoogte zakken, of de atleet het platform verlaat.', '§11.10'),
  ('long_cycle', 'no_count', 'Zelfde regels als Jerk (§11.11), plus: de kettlebell(s) laten “hangen” tussen de benen om te rusten, of meer dan één oscillatie in de dead-point-fase.', '§11.12-11.13'),
  ('snatch',     'no_count', 'Uitvoering als press-techniek, ontbrekende fixatie, de vrije hand die de kettlebell aanraakt (behalve tijdens een toegestane handwissel), of een ongeldige start vanaf het dode punt met wisseling tijdens de opwaartse beweging.', '§11.16'),
  ('snatch',     'other',    'Slechts één handwissel toegestaan per set; bij een tweede wissel volgt STOP. De kettlebell mag niet op schouder/platform rusten of “hangen” tussen de benen.', '§11.14-11.15'),
  ('all',        'equipment','Toegestane kettlebellgewichten in wedstrijd: 8, 12, 16, 20, 24, 28, 32, 36, 40, 48 kg. Gewichtstolerantie: max. 100 g afwijking.', '§1.4, §7.2'),
  ('all',        'clothing', 'Weightlifting-bodysuit, t-shirt/vest en shorts over de knie. Riem max. 12 cm achter/6 cm voor, 1,5 cm dik. Kniebandages max. 25 cm, polsbandages max. 12 cm.', '§5.1')
) as j(discipline, rule_type, description, source_ref)
where r.federation_id = (select id from kettlebell_federations where slug = 'wksf')
  and r.version = '2023-2027';
