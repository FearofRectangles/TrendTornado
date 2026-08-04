# D-003 - Placement

## Syfte
Representerar kopplingen mellan en Article och en Location.
Placement beskriver var en artikel är placerad just nu.

---

## Ansvar

- Koppla ihop en artikel med en lagerplats.
- Säkerställa att placeringen är giltig.

---

## Vet

- Vilken artikel som är placerad.
- Vilken plats den är placerad på.

---

## Affärsregler
En artikel kan endast ha en aktiv Placement.
En Location kan endast innehålla en aktiv Placement.
Artikelns temperaturzon måste matcha platsens temperaturzon.

---

## Design Notes
Placement är ett faktum.
Inte en rekommendation.
Placement säger endast: "Den här artikeln ligger här."
Om placeringen är bra avgörs senare av PlacementEvaluation.