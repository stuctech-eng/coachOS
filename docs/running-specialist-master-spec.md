# CoachOS Running Specialist v1.0 – Master Final Specification

**Status: bron-document, aangeleverd 19 juli 2026. Beschrijft het
volledige eindbeeld — zie `docs/running-specialist-roadmap-v1.md` voor
de gefaseerde uitvoering hiervan (Fase 1/2/3), inclusief welke
onderdelen al bestaan en welke nieuw zijn.**

## Filosofie

De Running Specialist is géén tweede Trainer AI.

De Trainer AI bepaalt:
- welke training vandaag uitgevoerd wordt;
- intervalschema's;
- hersteltraining;
- warming-up;
- cooling-down;
- techniekdrills.

De Running Specialist bepaalt:

"Hoe ontwikkelt de hardloper zich over weken, maanden en seizoenen?"

De specialist analyseert prestaties, belasting, trends en voortgang en adviseert de Trainer AI.

De Master Coach bewaakt herstel en gezondheid.
De Trainer AI bouwt de training.
De Running Specialist bewaakt de sportinhoud.

------------------------------------------------------------

## Architectuur

Master Coach
        │
        ▼
Coach Policy
        │
        ▼
Running Specialist
        │
        ▼
Trainer AI
        │
        ▼
Training uitvoeren

Na iedere training:

Training
        │
        ▼
Running Specialist analyse
        │
        ▼
Specialist Summary
        │
        ▼
Master Coach

------------------------------------------------------------

## Databron

Primair

Garmin TCX

Ondersteund

- Garmin
- Strava
- Polar
- Coros
- Suunto

Alle analyses worden uitsluitend gebaseerd op aanwezige data.

Geen AI-berekeningen.

AI interpreteert uitsluitend.

------------------------------------------------------------

## Wat een TCX-bestand levert

Datum

Starttijd

Duur

Afstand

GPS-track

Hoogte

Snelheid

Pace

Hartslag

Laps

Trackpoints

Cadans (indien aanwezig)

Running Power (indien aanwezig)

Temperatuur (indien aanwezig)

------------------------------------------------------------

## Niet aanwezig in TCX

Body Battery

Training Readiness

HRV Status

Stress

Recovery Time

Sleep Score

Training Status

Acute Load

VO2Max historie

Race Predictor

Hill Score

Endurance Score

Deze gegevens kunnen later via Garmin API worden toegevoegd.

------------------------------------------------------------

# Running Dashboard

De specialist krijgt een volledig dashboard.

------------------------------------------------------------

## Dashboard Header

Naam

Doel

Coach advies

Blessurestatus

Belangrijkste waarschuwing

------------------------------------------------------------

## Kernstatistieken

Weekafstand

Maandafstand

Jaarafstand

Totale kilometers

Trainingen deze week

Gemiddelde pace

Gemiddelde hartslag

Gemiddelde cadans

Hoogtemeters

Trainingstijd

Langste duurloop

Snelste training

------------------------------------------------------------

# Running Performance Center

## Persoonlijke records

100 meter

200 meter

400 meter

800 meter

1000 meter

1 km

1 mile

3 km

5 km

10 km

15 km

10 miles

Halve marathon

25 km

30 km

Marathon

Ultramarathon

------------------------------------------------------------

## Pace Curve

Niet vermogenscurve.

Maar:

Beste pace over

200 meter

400 meter

800 meter

1 km

3 km

5 km

10 km

15 km

20 km

30 km

Marathon

Hieruit ontstaat de Running Performance Curve.

------------------------------------------------------------

## Hartslag

Rusthartslag

Gemiddelde HR

Maximum HR

Zone 1

Zone 2

Zone 3

Zone 4

Zone 5

Tijd per zone

Trend

------------------------------------------------------------

## Pace Zones

Recovery

Easy

Steady

Marathon

Threshold

10K

5K

3K

VO2Max

Sprint

Automatisch berekend.

------------------------------------------------------------

## Cadans

Gemiddelde

Maximum

Trend

Cadansverdeling

Optimale range

------------------------------------------------------------

## Hoogte

Totale stijging

Totale daling

Gemiddeld stijgingspercentage

Steilste klim

Hoogste punt

------------------------------------------------------------

## Running Power

Indien aanwezig.

Gemiddeld

Maximum

Power zones

Trend

W/kg

------------------------------------------------------------

## Trainingsbelasting

Eigen CoachOS berekening.

Niet Garmin kopiëren.

Weekbelasting

Maandbelasting

Trend

Acute belasting

Chronische belasting

Belastingsontwikkeling

------------------------------------------------------------

## Progressie

5 km trend

10 km trend

Halve marathon trend

Marathon trend

Pace trend

Cadans trend

Hartslag trend

Running Power trend

Hersteltrend

------------------------------------------------------------

## Running Analyse

Na iedere training

Automatisch:

Negatieve split

Positieve split

Pacing analyse

Hartslagverloop

Cadansverloop

Hoogteprofiel

Snelste kilometer

Zwaarste kilometer

Beste tempo

Zwakste deel

Constantie

Efficiency

Coach conclusie

------------------------------------------------------------

## Running Coach

De Running Specialist leert.

Memory Engine

Confidence Engine

Goal Engine

Lifecycle Engine

Decision Engine

Coach Policy

Specialist Summary

Alles identiek aan Cycling.

------------------------------------------------------------

## Adaptief Trainingsplan

De Running Specialist bouwt geen trainingen.

Hij bouwt een planning.

Bijvoorbeeld:

Ma
Rust

Di
Interval

Wo
Herstel

Do
Tempo

Vr
Rust

Za
Lange duurloop

Zo
Easy Run

Trainer AI vult iedere training automatisch in.

------------------------------------------------------------

## Grafieken

Week

Maand

Jaar

Custom

Grafieken

Afstand

Pace

Hartslag

Cadans

Hoogte

Power

Belasting

Trainingstijd

Frequentie

Records

------------------------------------------------------------

## Running Goals

5 km

10 km

Halve marathon

Marathon

Ultra

Gewichtsdoel

Weekkilometers

Maandkilometers

Jaarafstand

Cadans

Hartslag

Running Power

Alles gekoppeld aan de bestaande Goal Engine.

------------------------------------------------------------

## Kalender

Geplande trainingen

Voltooide trainingen

Rustdagen

Wedstrijden

Blessures

Herstel

Automatisch bijgewerkt.

------------------------------------------------------------

## Wedstrijden (toekomst)

5 km

10 km

Halve marathon

Marathon

Trail

Ultra

De specialist bouwt automatisch naar een evenement toe.

------------------------------------------------------------

## Toekomstige Garmin API-uitbreidingen

Wanneer Garmin API beschikbaar is:

Body Battery

Training Readiness

Recovery Time

HRV Status

VO2Max

Race Predictor

Endurance Score

Hill Score

Training Status

Acute Load

Sleep Score

Stress

Morning Report

Deze worden toegevoegd aan de bestaande analyses zonder de architectuur te wijzigen.

------------------------------------------------------------

## Architectuurregels

- Data is de bron van waarheid.
- AI rekent nooit.
- Running Specialist analyseert.
- Trainer AI maakt trainingen.
- Master Coach bewaakt gezondheid.
- Alle berekeningen zijn deterministisch.
- Geen dubbele logica.
- Alle engines worden hergebruikt vanuit de bestaande Specialist-architectuur.
- De Running Specialist gebruikt exact dezelfde platformarchitectuur als de Cycling Specialist (Goal Engine, Memory Engine, Confidence Engine, Lifecycle Engine, Decision Engine en Coach Policy), zodat nieuwe specialisten later eenvoudig kunnen worden toegevoegd.
