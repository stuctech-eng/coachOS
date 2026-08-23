-- ============================================================
-- CoachOS Kettlebell Specialist — Discipline completeren (v2.4.357)
--
-- Bron: wksf.site/classic-10/ (rechtstreeks opgehaald, primair,
-- niet geblokkeerd door robots.txt). Bevestigt expliciet: "One Arm
-- Long Cycle (1 x Kettlebell) – do not enter on Junior Category" als
-- eigen discipline binnen Classic 10', naast (Two Arm) Long Cycle.
-- Dit is al zo geïmporteerd in de classificatiedata sinds v2.4.354
-- (discipline-sleutel 'one_arm_long_cycle_10'), maar
-- kettlebell_gs_sessions (sessieregistratie, MVP1) ondersteunde deze
-- discipline nog niet als aparte logbare optie — waardoor een atleet
-- die specifiek voor One Arm Long Cycle traint, dat niet los van
-- gewone Long Cycle kon vastleggen, en Beat My Class dus nooit een
-- PR voor die discipline kon vinden.
--
-- Jerk/Snatch/Biathlon/Relay Race blijven ongewijzigd: Jerk mag per
-- Rules §11.9 al met één of twee armen, geen aparte competitiecategorie
-- bij 10'-classic; Snatch is al inherent eenarmig; Relay Race blijft
-- bewust niet individueel loggable (teamdiscipline, zie eerdere
-- checkpoints).
-- ============================================================

alter table kettlebell_gs_sessions drop constraint if exists kettlebell_gs_sessions_discipline_check;
alter table kettlebell_gs_sessions add constraint kettlebell_gs_sessions_discipline_check
  check (discipline in ('jerk', 'snatch', 'long_cycle', 'biathlon', 'one_arm_long_cycle'));
