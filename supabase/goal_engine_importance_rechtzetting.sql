-- ============================================================
-- CoachOS Specialist Coach Platform — Goal Engine, rechtzetting (v2.4.87)
-- Correctie op v2.4.86: 'urgency' was daar een door de gebruiker
-- ingevuld, statisch veld — dat vermengt twee verschillende concepten:
--
-- - IMPORTANCE (gebruikerskeuze, stabiel): hoe belangrijk vindt de
--   gebruiker dit doel? Verandert nauwelijks.
-- - URGENCY (door de Goal Engine berekend, dynamisch): hoe urgent is
--   het VANDAAG, gegeven de naderende deadline? Verandert continu.
--
-- Dit script werkt veilig ongeacht of v2.4.86 al is gedraaid: hernoemt
-- de kolom als die al bestaat, maakt 'm anders gewoon aan.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'user_goals' and column_name = 'urgency'
  ) then
    alter table user_goals rename column urgency to importance;
  elsif not exists (
    select 1 from information_schema.columns
    where table_name = 'user_goals' and column_name = 'importance'
  ) then
    alter table user_goals add column importance text not null default 'normal';
  end if;
end $$;

-- Oude check-constraint (critical/high/normal/low) vervangen door de
-- nieuwe schaal (must/high/normal/low) — "must" i.p.v. "critical", want
-- dit is nu een gebruikerskeuze ("dit MOET ik behalen"), geen berekende
-- urgentie meer
alter table user_goals drop constraint if exists user_goals_urgency_check;
alter table user_goals drop constraint if exists user_goals_importance_check;

-- Bestaande waarden migreren: 'critical' → 'must', rest blijft gelijk
update user_goals set importance = 'must' where importance = 'critical';

alter table user_goals add constraint user_goals_importance_check
  check (importance in ('must', 'high', 'normal', 'low'));

comment on column user_goals.importance is
  'Door de GEBRUIKER ingesteld, stabiel — hoe belangrijk vindt de gebruiker dit doel. NIET hetzelfde als urgency (die is nu een berekend veld, geen kolom, zie goal-engine.ts). NIET hetzelfde als het bestaande "priority"-veld (dat is weergavevolgorde).';
