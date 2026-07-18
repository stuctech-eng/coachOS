-- ============================================================
-- Cycling Specialist Roadmap v1.0 — Fase 1: Cycling Foundation
-- Bron: docs/cycling-specialist-roadmap-v1.md
--
-- birth_date op het ALGEMENE profiel (profiles), niet cycling-
-- specifiek — de onderbouwing (leeftijdscategorieën, Masters-
-- categorieën, leeftijdsafhankelijke hartslagzones) is sport-
-- overstijgend en dus ook bruikbaar voor Running en toekomstige
-- specialisten. age blijft bestaan, wordt dynamisch berekend voor
-- weergave totdat een gebruiker zijn geboortedatum invult.
--
-- Cycling-specifieke velden (FTP, max hartslag, sensoren, trainings-
-- dagen, beschikbare uren) worden BEWUST NIET in een nieuwe tabel
-- gezet — specialist_profiles.preferences (jsonb) bestaat al en wordt
-- al gebruikt voor specialist-specifieke instellingen. Geen nieuwe
-- tabel nodig voor iets dat al een geschikte, bestaande plek heeft.
-- ============================================================

alter table profiles
  add column if not exists birth_date date;

comment on column profiles.birth_date is
  'Nieuwe bron van waarheid voor leeftijd (Cycling Specialist Roadmap v1.0, Fase 1). Vervangt geleidelijk het bestaande "age"-veld — age blijft tijdelijk bestaan, dynamisch berekend voor weergave, totdat de gebruiker dit invult.';
