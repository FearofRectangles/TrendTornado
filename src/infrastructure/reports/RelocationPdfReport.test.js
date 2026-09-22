import test from "node:test";
import assert from "node:assert/strict";
import { RelocationPdfReport } from "./RelocationPdfReport.js";

test("creates a valid multi-page PDF document", () => {
  const recommendations = Array.from({ length: 25 }, (_, index) => ({
    utility: { score: 80 }, articleNumber: String(index), name: "Artikel",
    currentLocation: "020030101", recommendedZone: "02", recommendedSection: "BEGINNING",
    placementGap: 0.4, pickedQuantityPerWeek: 12, classification: { classification: "AX" },
    direction: "EARLIER", placementOptions: null,
  }));
  const result = RelocationPdfReport.create({ recommendations, analysis: { name: "Test", periodStart: "2025-01-01", periodEnd: "2025-12-31" } });
  assert.equal(result.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.match(result.toString("latin1"), /\/Count 2/);
  assert.match(result.toString("latin1"), /%%EOF$/);
});
