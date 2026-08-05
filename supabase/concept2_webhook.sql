-- Concept2-webhook, v2.4.286
-- Nodig om een binnenkomende webhook-payload (bevat Concept2's eigen
-- numerieke user_id) terug te vertalen naar de juiste CoachOS-gebruiker.

alter table concept2_tokens add column if not exists concept2_user_id bigint;
create index if not exists idx_concept2_tokens_concept2_user_id on concept2_tokens(concept2_user_id);
