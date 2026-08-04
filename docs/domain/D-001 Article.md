# D-001 - Article

## Syfte

Representerar en fysisk produkt som kan lagerhållas och plockas.
En Article beskriver endast produktens permanenta egenskaper.
Den innehåller ingen information som förändras över tid.

---

## Ansvar

- Identifiera produkten.
- Beskriva produktens fysiska egenskaper.
- Beskriva vilka krav produkten ställer på en lagerplats.

---

## Vet

- Artikelnummer
- Namn
- Vikt
- Volym (framtida version)
- Temperaturzon
- Eventuell produktkategori

---

## Affärsregler

- Artikelnummer måste vara unikt.
- Vikt kan inte vara negativ.
- Temperaturzon måste anges.

---

## Design Notes

Plockfrekvens lagras aldrig på Article.
