import test from "node:test";
import assert from "node:assert/strict";

import {
  ErgonomicRecommendation,
} from "./ErgonomicRecommendation.js";

import {
  ErgonomicRecommendationEngine,
} from "./ErgonomicRecommendationEngine.js";

test("allows flexible height for light handling", () => {
  const result =
    ErgonomicRecommendationEngine.evaluate({
      weightKg: 1,
      averageHandledWeightPerPick: 2,
    });

  assert.equal(
    result.recommendation,
    ErgonomicRecommendation.HIGH_OK,
  );
});

test("prefers low placement for moderate handled weight", () => {
  const result =
    ErgonomicRecommendationEngine.evaluate({
      weightKg: 2,
      averageHandledWeightPerPick: 6,
    });

  assert.equal(
    result.recommendation,
    ErgonomicRecommendation.LOW_PREFERRED,
  );
});

test("strongly recommends low placement for high handled weight", () => {
  const result =
    ErgonomicRecommendationEngine.evaluate({
      weightKg: 2,
      averageHandledWeightPerPick: 12,
    });

  assert.equal(
    result.recommendation,
    ErgonomicRecommendation
      .LOW_STRONGLY_RECOMMENDED,
  );
});

test("strongly recommends low placement for a heavy individual unit", () => {
  const result =
    ErgonomicRecommendationEngine.evaluate({
      weightKg: 10,
      averageHandledWeightPerPick: 5,
    });

  assert.equal(
    result.recommendation,
    ErgonomicRecommendation
      .LOW_STRONGLY_RECOMMENDED,
  );
});

test("does not confuse low average handling with a light unit", () => {
  const result =
    ErgonomicRecommendationEngine.evaluate({
      weightKg: 12,
      averageHandledWeightPerPick: 6,
    });

  assert.equal(
    result.recommendation,
    ErgonomicRecommendation
      .LOW_STRONGLY_RECOMMENDED,
  );
});

test("rejects invalid weight", () => {
  assert.throws(
    () =>
      ErgonomicRecommendationEngine.evaluate({
        weightKg: -1,
        averageHandledWeightPerPick: 5,
      }),
    /weight/i,
  );
});

test("rejects invalid handled weight", () => {
  assert.throws(
    () =>
      ErgonomicRecommendationEngine.evaluate({
        weightKg: 2,
        averageHandledWeightPerPick: -1,
      }),
    /handled weight/i,
  );
});