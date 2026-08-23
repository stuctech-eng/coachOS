-- ============================================================
-- CoachOS Kettlebell Specialist — Block A/B statusbesluit (v2.4.356)
--
-- Besluit van de gebruiker na multi-bron onderzoek (zie
-- docs/sources/wksf-block-ab-investigation.md voor het volledige
-- rapport): de betekenis van ranking_block A/B is STERK aangewezen
-- (waarschijnlijk A=zwaarste, B=lichtste kettlebellgewicht) maar NIET
-- officieel bevestigd door een primaire WKSF-legenda. Daarom een
-- tussenstatus 'strongly_indicated' — nadrukkelijk NIET hetzelfde als
-- 'verified'. bell_weight_kg blijft op alle 720 rijen NULL.
-- ============================================================

-- ── Check-constraint uitbreiden met de nieuwe status ────────────
alter table kettlebell_classifications drop constraint if exists kettlebell_classifications_source_status_check;
alter table kettlebell_classifications add constraint kettlebell_classifications_source_status_check
  check (source_status in ('verified', 'strongly_indicated', 'unresolved_block_weight', 'source_anomaly'));

comment on column kettlebell_classifications.source_status is
  'verified = primaire WKSF-bron bevestigt de A/B-mapping expliciet (nog niet in gebruik). strongly_indicated = sterke indirecte bevestiging (meerdere onafhankelijke aanwijzingen), geen primaire expliciete mapping — NOOIT door de applicatie behandelen alsof bell_weight_kg bekend is. unresolved_block_weight = betekenis nog onvoldoende vastgesteld. source_anomaly = brontekst zelf bevat een onopgeloste onduidelijkheid.';

-- ── De 700 normale rijen krijgen de nieuwe, preciezere status ───
-- De 20 al gemarkeerde source_anomaly-rijen blijven ongewijzigd —
-- die hebben een ander, apart probleem (twijfelachtige brontekst,
-- los van de A/B-betekenisvraag).

update kettlebell_classifications
set source_status = 'strongly_indicated'
where source_status = 'unresolved_block_weight';

-- ── Sanity check ─────────────────────────────────────────────
-- select source_status, count(*) from kettlebell_classifications group by source_status;
-- verwacht: strongly_indicated = 700, source_anomaly = 20
