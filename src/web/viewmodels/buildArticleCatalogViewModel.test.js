import test from "node:test";
import assert from "node:assert/strict";
import { buildArticleCatalogViewModel } from "./buildArticleCatalogViewModel.js";

test("includes master articles without history and enriches analyzed articles", () => {
  const location = {
    locationCode: "200010101",
    zone: "20",
    pickZoneType: "KOLONIAL",
  };
  const masterArticles = [
    { articleNumber: "A", name: "Analyzed", weightKg: 2, temperatureZone: "KOL", category: null },
    { articleNumber: "B", name: "No history", weightKg: 1, temperatureZone: "KOL", category: null },
  ];
  const analysis = {
    evaluations: { all: [{ articleNumber: "A", currentPosition: 0.8, desiredPosition: 0.1, placementGap: 0.7, priorityScore: 0.9, averageHandledWeightPerPick: 4 }] },
    recommendations: [],
    warehouse: {
      physicalZoneSequence: [{ location, zoneSection: "BEGINNING" }],
      pickSequence: [{ location, relativePickPosition: 0.8 }],
    },
    placements: { pickPlacements: [] },
    articles: {
      classification: { observedWeekCount: 5, byArticle: new Map() },
      positioned: [{
        ...masterArticles[0],
        pickFrequency: 10,
        pickedQuantity: 25,
        averageQuantityPerPick: 2.5,
        positionedPickLocations: [{ location, relativePickPosition: 0.8 }],
      }],
    },
  };

  const result = buildArticleCatalogViewModel(analysis, masterArticles);
  assert.equal(result.length, 2);
  assert.equal(result[0].articleNumber, "A");
  assert.equal(result[0].pickFrequency, 10);
  assert.equal(result[0].pickedQuantityPerWeek, 5);
  assert.equal(result[0].isRelocationCandidate, true);
  assert.equal(result[1].articleNumber, "B");
  assert.equal(result[1].pickFrequency, 0);
  assert.equal(result[1].priorityScore, null);
});

test("keeps a hidden relocation article searchable in the catalog", () => {
  const location = { locationCode: "200010101", zone: "20", pickZoneType: "KOLONIAL" };
  const master = { articleNumber: "A", name: "Fast placering", weightKg: 2, temperatureZone: "KOL" };
  const analysis = {
    evaluations: { all: [{ articleNumber: "A", currentPosition: .8, desiredPosition: .1, placementGap: .7, priorityScore: .9 }] },
    recommendations: [],
    warehouse: { physicalZoneSequence: [{ location, zoneSection: "BEGINNING" }], pickSequence: [{ location, relativePickPosition: .8 }] },
    placements: { pickPlacements: [] },
    articles: { classification: { observedWeekCount: 5, byArticle: new Map() }, positioned: [{ ...master, pickFrequency: 10, pickedQuantity: 10, positionedPickLocations: [{ location, relativePickPosition: .8 }] }] },
  };
  const [article] = buildArticleCatalogViewModel(analysis, [master], { articleRules: [{ articleNumber: "A", hideRelocation: true }] });
  assert.equal(article.articleNumber, "A");
  assert.equal(article.pickFrequency, 10);
  assert.equal(article.isRelocationCandidate, false);
});
