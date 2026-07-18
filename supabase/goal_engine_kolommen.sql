-- ============================================================
-- CoachOS Specialist Coach Platform — Goal Engine
-- Bron: vervolgoverleg op specialist-api.md v2.4.72 (Global vs.
-- Specialist Goals) en de Decision Engine-regels 4-5.
--
-- LET OP: 'priority' bestaat al op user_goals (integer,
-- weergavevolgorde, auto-opgehoogd — zie api/goals/route.ts). Dit is
-- GEEN urgentie-classificatie. Vandaar een nieuwe kolom 'urgency',
-- geen hergebruik/overschrijving van 'priority'.
-- ============================================================

alter table user_goals
  add column if not exists goal_scope text not null default 'global'
    check (goal_scope in ('global', 'specialist'));

alter table user_goals
  add column if not exists specialist_type text;

alter table user_goals
  add column if not exists urgency text not null default 'normal'
    check (urgency in ('critical', 'high', 'normal', 'low'));

comment on column user_goals.goal_scope is
  'global = Master Coach-niveau (bijv. "minder stress", "beter slapen"). specialist = geldt alleen voor één specialist (bijv. FTP-target). Bestaande rijen krijgen default "global" — backwards compatible.';
comment on column user_goals.specialist_type is
  'Alleen relevant/gevuld als goal_scope=specialist. Welke specialist dit doel "bezit" (bijv. cycling, running).';
comment on column user_goals.urgency is
  'Urgentie-classificatie voor de Decision Engine (regels 4-5): critical (bijv. revalidatie/blessure) > high (A-wedstrijd) > normal (standaard) > low (ooit, geen druk). NIET hetzelfde als het bestaande "priority"-veld (dat is weergavevolgorde).';

-- Optionele index — versnelt "geef me alle doelen van specialist X"
create index if not exists idx_user_goals_specialist
  on user_goals(user_id, specialist_type)
  where goal_scope = 'specialist';
