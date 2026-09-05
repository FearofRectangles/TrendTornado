import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalysisViewModel } from "./buildAnalysisViewModel.js";

test("builds distributions, scatter points and simulation comparison", () => {
  const evaluation = {
    articleNumber: "A",
    averageHandledWeightPerPick: 12,
    currentPosition: 0.8,
    priorityScore: 0.9,
    placementGap: 0.7,
  };
  const location = { pickZoneType: "KOLONIAL", ergonomicLevel: null };
  const analysis = {
    articles: { positioned: [{ articleNumber: "A", name: "A", pickFrequency: 12, positionedPickLocations: [{ location }] }] },
    evaluations: { all: [evaluation] },
    recommendations: [{ ergonomicRecommendation: { recommendation: "LOW_STRONGLY_RECOMMENDED" } }],
    warehouse: { pickSequence: [{ location }] },
    simulation: {
      movementThreshold: 0.2,
      coverage: 0.5,
      diagnostics: {},
      baseline: { correctlyOrderedPairs: 4 },
      optimized: { correctlyOrderedPairs: 7 },
      comparison: {},
    },
  };

  const result = buildAnalysisViewModel(analysis);
  assert.equal(result.frequency.bins.find((bin) => bin.label === "11–25").count, 1);
  assert.equal(result.weight.bins.find((bin) => bin.label === "10–15 kg").count, 1);
  assert.equal(result.scatter.points[0].candidate, true);
  assert.equal(result.weight.lowStronglyRecommended, 1);
  assert.equal(result.simulation.improvedWeightPairs, 3);
});
