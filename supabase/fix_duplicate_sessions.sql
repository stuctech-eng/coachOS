-- v2.4.259: unique constraint als tweede beveiligingslaag tegen dubbele
-- trainingsplan-sessies. De applicatie-idempotency-check (v2.4.259, in
-- core.ts) dekt de meeste gevallen, maar is niet 100% race-condition-
-- vrij bij écht gelijktijdige aanroepen (twee requests die allebei de
-- "bestaat het al?"-check passeren vóórdat de eerste insert is voltooid).
-- Deze constraint maakt een duplicaat op database-niveau onmogelijk.
--
-- BELANGRIJK: voer eerst de opschoon-query hieronder uit (verwijdert
-- bestaande duplicaten), anders faalt het toevoegen van de constraint.

-- Stap 1: bestaande duplicaten opschonen — behoudt de OUDSTE rij per
-- (plan_id, date)-combinatie, verwijdert de rest
delete from training_plan_sessions a
using training_plan_sessions b
where a.plan_id = b.plan_id
  and a.date = b.date
  and a.id > b.id;

-- Stap 2: unique constraint toevoegen
alter table training_plan_sessions
  add constraint training_plan_sessions_plan_date_uniek unique (plan_id, date);
