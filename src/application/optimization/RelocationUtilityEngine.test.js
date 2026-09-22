import test from "node:test";
import assert from "node:assert/strict";
import { RelocationUtilityEngine } from "./RelocationUtilityEngine.js";

const base = {
  ergonomicRecommendation: "FLEXIBLE",
  classification: { quality: "STRONG", xyzClass: "X" },
  placementOptions: { dataQuality: "ESTIMATED", direct: [{ withinTargetInterval: true }], swaps: [], adjustments: [] },
};

test("ranks an active earlier move above an inactive move with a larger gap", () => {
  const [first, second] = RelocationUtilityEngine.score([
    { ...base, articleNumber: "ACTIVE", frequencyScore: 0.9, placementGap: 0.45 },
    { ...base, articleNumber: "RARE", frequencyScore: 0.05, placementGap: 0.85 },
  ]);
  assert.equal(first.articleNumber, "ACTIVE");
  assert.ok(first.utility.score > second.utility.score);
});

test("uses space release value for moves later", () => {
  const [result] = RelocationUtilityEngine.score([
    { ...base, articleNumber: "RARE", frequencyScore: 0.05, placementGap: -0.7 },
  ]);
  assert.equal(result.utility.directionModel, "SPACE_RELEASE");
  assert.ok(result.utility.components.flowImpact > 0.6);
  assert.ok(result.utility.score < 60);
});
