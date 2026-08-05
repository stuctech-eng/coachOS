-- Coach Decision Engine, Fase 1 — v2.4.288
-- Nieuwe kolom: bewaart WAAROM de Decision Engine een Coach Call nodig
-- vond (bestaande vier aanmaakplekken vulden dit nooit, want zij hadden
-- geen "waarom"-classificatie — puur additief, breekt niets aan hoe
-- bestaande items nu al gerenderd worden).

alter table coach_call_items add column if not exists deviation_reason text;
