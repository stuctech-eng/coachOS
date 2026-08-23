-- ============================================================
-- CoachOS Kettlebell Specialist — MVP2 vervolg (v2.4.355)
-- FASE 2 (disciplines) + FASE 3 (Competition-model)
-- ============================================================

-- ── FASE 2 — Disciplineverduidelijking, GEEN herstructurering ──
-- Bron: officieel WKSF-presentatiedocument "WKSF 2023-2027"
-- (via zoekresultaat-snippet gevonden, PDF zelf niet volledig
-- ophaalbaar — robots.txt op de hostende site). Bevestigt: de
-- 30'/60'-marathonformaten zijn specifiek "One Arm Jerk" en
-- "One Arm Long Cycle" — geen aparte disciplines naast de al
-- geïmporteerde jerk_30/jerk_60/long_cycle_30/long_cycle_60, maar
-- wel een preciezere officiële naam voor diezelfde data. TALC
-- ("Two Arm Long Cycle") is volgens deze bron specifiek de
-- 10-minuten-classic-vorm (= al geïmporteerd als long_cycle_10). OAS
-- ("One Arm Snatch") is een alias voor snatch_10/snatch_12, want
-- Snatch is per Rules-document (§1.4) altijd eenarmig.
--
-- Bewust GEEN rename van bestaande discipline-sleutels: dat zou
-- 700 al geïmporteerde, geverifieerde classificatierijen breken
-- voor een puur cosmetische naamswijziging. In plaats daarvan: een
-- alias/toelichting op de al bestaande rulebook_discipline-rijen.

alter table kettlebell_rulebook_disciplines add column if not exists official_alias text;

update kettlebell_rulebook_disciplines
set official_alias = 'One Arm Jerk (WKSF-presentatie 2023-2027, marathonformaat 30''/60'')'
where discipline in ('jerk_30', 'jerk_60');

update kettlebell_rulebook_disciplines
set official_alias = 'One Arm Long Cycle (WKSF-presentatie 2023-2027, marathonformaat 30''/60'')'
where discipline in ('long_cycle_30', 'long_cycle_60');

update kettlebell_rulebook_disciplines
set official_alias = 'Two Arm Long Cycle / TALC (WKSF-presentatie 2023-2027, classic 10''-formaat)'
where discipline = 'long_cycle_10';

update kettlebell_rulebook_disciplines
set official_alias = 'One Arm Snatch / OAS — Snatch is per Rules §1.4 altijd eenarmig'
where discipline in ('snatch_10', 'snatch_12');

comment on column kettlebell_rulebook_disciplines.official_alias is
  'Toelichting/alternatieve officiële benaming (bijv. TALC/OAJ/OALC/OAS) uit aanvullende WKSF-brondocumenten. Wijzigt de discipline-sleutel zelf niet — voorkomt een breaking change op bestaande classificatiedata.';

-- ── FASE 3 — Competition-model uitbreiden (NIET dupliceren) ────
-- kettlebell_competitions/kettlebell_competition_entries bestaan al
-- (v2.4.352). Uitbreiden met de velden die FASE 3 vraagt en die nog
-- ontbraken: discipline/gender/bodyweight/bell_weight/ranking_block/
-- reps/source_reference op de entry (het daadwerkelijke resultaat),
-- zodat een wedstrijdresultaat volledig los van een classification-
-- norm vastgelegd kan worden (expliciete eis: resultaat ≠ norm).

alter table kettlebell_competition_entries add column if not exists sex text check (sex in ('male', 'female'));
alter table kettlebell_competition_entries add column if not exists bodyweight_class text;
alter table kettlebell_competition_entries add column if not exists bell_weight_kg numeric;
alter table kettlebell_competition_entries add column if not exists ranking_block text check (ranking_block in ('A', 'B'));
alter table kettlebell_competition_entries add column if not exists reps integer;
alter table kettlebell_competition_entries add column if not exists source_reference text;

comment on column kettlebell_competition_entries.reps is
  'Daadwerkelijk behaald wedstrijdresultaat. GEEN classificatienorm — zie kettlebell_classifications voor de norm zelf.';
comment on column kettlebell_competition_entries.ranking_block is
  'Optioneel: welk rankingblok (A/B) de atleet zelf koos voor context bij dit resultaat — geen automatische koppeling aan bell_weight_kg, zelfde voorbehoud als kettlebell_classifications.';

alter table kettlebell_competitions add column if not exists discipline text;

comment on column kettlebell_competitions.discipline is
  'Optioneel: hoofddiscipline van de wedstrijd, indien de wedstrijd zich op één discipline richt (bijv. een Long Cycle-only event). Individuele deelnames kunnen alsnog een andere discipline hebben via kettlebell_competition_entries.discipline.';
