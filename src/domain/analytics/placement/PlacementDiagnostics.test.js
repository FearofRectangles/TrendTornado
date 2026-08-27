import test from "node:test";
import assert from "node:assert/strict";

import {
  PlacementDiagnostics,
} from "./PlacementDiagnostics.js";

function createEvaluation({
  frequencyScore,
  handlingScore,
  priorityScore,
}) {
  return {
    frequencyScore,
    handlingScore,
    priorityScore,
  };
}

test("calculates score distributions", () => {
  const evaluations = [
    createEvaluation({
      frequencyScore: 0,
      handlingScore: 0.1,
      priorityScore: 0.2,
    }),

    createEvaluation({
      frequencyScore: 0.25,
      handlingScore: 0.3,
      priorityScore: 0.4,
    }),

    createEvaluation({
      frequencyScore: 0.5,
      handlingScore: 0.5,
      priorityScore: 0.6,
    }),

    createEvaluation({
      frequencyScore: 0.75,
      handlingScore: 0.7,
      priorityScore: 0.8,
    }),

    createEvaluation({
      frequencyScore: 1,
      handlingScore: 0.9,
      priorityScore: 1,
    }),
  ];

  const result =
    PlacementDiagnostics.analyze(
      evaluations,
    );

  assert.equal(
    result.count,
    5,
  );

  assert.equal(
    result.frequencyScore.min,
    0,
  );

  assert.equal(
    result.frequencyScore.median,
    0.5,
  );

  assert.equal(
    result.frequencyScore.max,
    1,
  );

  assert.equal(
    result.priorityScore.p25,
    0.4,
  );

  assert.equal(
    result.priorityScore.p75,
    0.8,
  );
});

test("interpolates percentiles", () => {
  const evaluations = [
    createEvaluation({
      frequencyScore: 0,
      handlingScore: 0,
      priorityScore: 0,
    }),

    createEvaluation({
      frequencyScore: 1,
      handlingScore: 1,
      priorityScore: 1,
    }),
  ];

  const result =
    PlacementDiagnostics.analyze(
      evaluations,
    );

  assert.equal(
    result.priorityScore.median,
    0.5,
  );

  assert.equal(
    result.priorityScore.p25,
    0.25,
  );

  assert.equal(
    result.priorityScore.p75,
    0.75,
  );
});

test("handles a single evaluation", () => {
  const evaluations = [
    createEvaluation({
      frequencyScore: 0.5,
      handlingScore: 0.6,
      priorityScore: 0.7,
    }),
  ];

  const result =
    PlacementDiagnostics.analyze(
      evaluations,
    );

  assert.equal(
    result.count,
    1,
  );

  assert.equal(
    result.priorityScore.min,
    0.7,
  );

  assert.equal(
    result.priorityScore.median,
    0.7,
  );

  assert.equal(
    result.priorityScore.max,
    0.7,
  );
});

test("handles an empty evaluation list", () => {
  const result =
    PlacementDiagnostics.analyze(
      [],
    );

  assert.deepEqual(
    result,
    {
      count: 0,
      frequencyScore: null,
      handlingScore: null,
      priorityScore: null,
    },
  );
});

test("rejects non-array input", () => {
  assert.throws(
    () =>
      PlacementDiagnostics.analyze(
        null,
      ),
    /must be an array/i,
  );
});