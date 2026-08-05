# D-002 - Location

Location
├── locationCode
├── zone       ← tecken 1–2
├── bay        ← tecken 3–5
├── shelf      ← tecken 6–7
├── position   ← tecken 8–9
├── temperatureZone
└── ergonomicLevel

## Syfte
Representerar en fysisk plockplats i lagret.
En Location beskriver endast själva platsen.
Den vet ingenting om vilken artikel som ligger där.

---

## Ansvar

- Identifiera lagerplatsen.
- Beskriva platsens egenskaper.
- Beskriva platsens lämplighet.

---

## Vet

- LocationCode
- PickSequence
- Zon
- Hyllnivå
- Temperaturzon
- LocationProfile

---

## Affärsregler

- PickSequence måste vara unik.
- Temperaturzon måste finnas.
- Hyllnivå måste anges.

---

## Design Notes

Location beskriver endast den fysiska platsen.
Den innehåller ingen information om hur effektiv platsen är.
Det utvärderas senare av PlacementEvaluation.