-- ============================================================
-- Training Plan Engine — multi-sport-ondersteuning
-- Bron: overleg 19 juli 2026 (Running Adaptive Training Plan)
-- ============================================================
--
-- training_plan_sessions had al een sport-kolom ("voor toekomstige
-- multi-sport-plannen"), maar training_plans zelf niet — zonder deze
-- kolom zou het activeren van een Running-plan een actief Cycling-plan
-- (of andersom) kunnen afsluiten, want de "sluit bestaand actief plan"-
-- query filterde alleen op athlete_id + status, niet op sport.
--
-- ⚠️ CONTROLEER EERST of je dit al eerder hebt uitgevoerd (bij de
-- v2.4.132-levering) — dit commando is veilig om opnieuw te draaien
-- (IF NOT EXISTS), maar dubbel uitvoeren is dus geen probleem als je
-- het niet meer zeker weet.

alter table training_plans add column if not exists sport text not null default 'cycling';

create index if not exists idx_training_plans_athlete_sport
  on training_plans(athlete_id, sport, status);

comment on column training_plans.sport is
  'Welke specialist dit plan beheert (cycling/running/...). Bestaande rijen krijgen automatisch cycling als default.';
