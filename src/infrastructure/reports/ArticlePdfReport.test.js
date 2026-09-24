import test from "node:test";
import assert from "node:assert/strict";
import { ArticlePdfReport } from "./ArticlePdfReport.js";

test("creates a valid multi-page article register PDF", () => {
  const articles = Array.from({ length: 25 }, (_, index) => ({
    articleNumber: String(10000 + index),
    name: `Testartikel ${index + 1}`,
    classification: { classification: index % 2 ? "AX" : "BY" },
    currentLocation: "020030101",
    pickFrequency: 42,
    pickStopsPerWeek: 2.1,
    pickedQuantityPerWeek: 12.5,
  }));
  const result = ArticlePdfReport.create({ articles, analysis: { name: "Test", periodStart: "2025-01-01", periodEnd: "2025-12-31" } });
  assert.equal(result.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.match(result.toString("latin1"), /\/Count 2/);
  assert.match(result.toString("latin1"), /Plock\/vecka/);
  assert.match(result.toString("latin1"), /%%EOF$/);
});
