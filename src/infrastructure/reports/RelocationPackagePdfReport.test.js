import test from "node:test";
import assert from "node:assert/strict";
import { RelocationPackagePdfReport } from "./RelocationPackagePdfReport.js";

test("creates a valid PDF for an ordered relocation package", () => {
  const pdf = RelocationPackagePdfReport.create({
    analysis: { name: "Testanalys", periodStart: "2026-01-01", periodEnd: "2026-03-31" },
    packagePlan: {
      pickZone: "KOLONIAL",
      sizeLabel: "Litet",
      chainCount: 1,
      startLocationCodes: ["010010101"],
      finalFreeLocationCodes: ["010030101"],
      startLocationCode: "010010101",
      finalFreeLocationCode: "010030101",
      steps: [{
        step: 1,
        chainNumber: 1,
        articleNumber: "A1",
        name: "Testartikel",
        fromLocationCode: "010030101",
        toLocationCode: "010010101",
        actionType: "EMPTY_LOCATION",
        spanImprovement: 0.01,
        capacity: { estimatedCapacity: 12, estimatedDaysOfDemand: 6 },
      }],
    },
  });
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdf.length > 500);
});
