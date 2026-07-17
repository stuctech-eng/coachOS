-- ============================================================
-- CoachOS Specialist Coach Platform — CoachPolicy-contract, sub-stap 2
-- Rechtzetting op v2.4.79: specialist_summary werd daar bewust NIET
-- opgeslagen (alleen in de API-response), maar dat betekent dat de
-- Master Coach het nergens kan lezen. Kleine, backwards-compatible
-- toevoeging: één nullable kolom, geen wijziging aan bestaande data.
-- ============================================================

alter table specialist_analyses
  add column if not exists specialist_summary jsonb;

comment on column specialist_analyses.specialist_summary is
  'SpecialistSummary (docs/specialist-coach-policy.md) — load/progress/risk/recommendation/confidence/reasons. Los van analysis (dat blijft exact CyclingCoachAdvies, user-facing). Door de Master Coach gelezen, sinds v2.4.80.';
