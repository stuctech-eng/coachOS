-- ============================================================
-- Adaptive Training Plan Engine — Fase 2 (Coach-uitleglaag)
-- Bron: docs/adaptive-training-plan-decision-contract-v1.md, sectie 5
-- ============================================================

alter table training_plan_sessions
  add column if not exists explanation text;

alter table training_plan_sessions
  add column if not exists explained_at timestamptz;

comment on column training_plan_sessions.explanation is
  'AI-gegenereerde menselijke uitleg (Fase 2, Coach-uitleglaag). AI ontvangt decision + reason code + context, beslist NIETS. Gecachet op de sessie zelf, geen aparte tabel nodig.';
