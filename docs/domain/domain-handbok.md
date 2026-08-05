# Domain Handbok

## Syfte
TrendTornado är ett beslutsstödsystem för lageroptimering.
Systemets syfte är inte att flytta artiklar.
Systemets syfte är att analysera en lagerlayout och identifiera förbättringar som leder till:

kortare plocktid,
bättre ergonomi,
färre omplock,
bättre utnyttjande av lagerplatser,
enklare påfyllning.

Flyttförslag är en konsekvens av analysen.

## Vision
TrendTornado ska fungera som en digital rådgivare för lagerlayout.

Systemet ska kunna analysera historisk orderdata, förstå hur lagret används och föreslå förbättringar som är objektiva, motiverade och mätbara.

Alla rekommendationer ska kunna förklaras.

## Ordlista
Artikel - en produkt som kan lagerhållas
plockfrekvens - Antalet unika order en artikel förekommer under en bestämd tid. 
pick sequence - Den ordning plckaren passerar en plats i plockslingan
placment - kopplingen mellan en artikel och dess nuvarande lagerplats. 
location - En fysisk plockplats.
Zone - En logisk del av lagret. 
Analysis - En körning av TrendTornado
Rekommendation - En rekommendation som skapats av TrendTornado

## Objectöversikt
D-001 Article
D-002 Location
D-003 Placement
D-004 Strategy


D-004 Warehouse
D-005 Zone
D-006 Order
D-007 OrderLine
D-008 Analytics
D-009 ArticleStatistics
D-010 PlacementEvaluator
D-011 PlacementEvaluation
D-012 RankingEngine
D-013 Recommendation
D-014 LayoutEvaluation

## Parking Lot
AI-optimering
ABC-klassificering
3D-lager
Heatmaps
Flyttkedjor
Dashboard
Routing
Voice Picking
Påfyllningsoptimering
Säsongsanalyser