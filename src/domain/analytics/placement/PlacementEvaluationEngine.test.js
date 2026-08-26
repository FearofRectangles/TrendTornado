import test from "node:test";
import assert from "node:assert/strict";

import {
  PlacementEvaluationEngine,
} from "./PlacementEvaluationEngine.js";

function createArticle({
  articleNumber,
  frequency,
  weight,
  position,
  pickZoneType = "KYLT",
}) {
  return {
    articleNumber,
    articleFound: true,
    pickFrequency: frequency,
    weightKg: weight,

    positionedPickLocations: [
      {
        relativePickPosition: position,

        location: {
          pickZoneType,
        },
      },
    ],
  };
}

test("evaluates article placement using frequency and weight", () => {
  const articles = [
    createArticle({
      articleNumber: "A",
      frequency: 100,
      weight: 10,
      position: 0.9,
    }),

    createArticle({
      articleNumber: "B",
      frequency: 10,
      weight: 1,
      position: 0.1,
    }),
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  const articleA = result.find(
    (item) =>
      item.articleNumber === "A",
  );

  assert.equal(
    articleA.frequencyScore,
    1,
  );

  assert.equal(
    articleA.weightScore,
    1,
  );

  assert.equal(
    articleA.priorityScore,
    1,
  );

  assert.equal(
    articleA.desiredPosition,
    0,
  );

  assert.equal(
    articleA.placementGap,
    0.9,
  );
});

test("compares articles only within the same pick zone", () => {
  const articles = [
    createArticle({
      articleNumber: "KYL-A",
      frequency: 100,
      weight: 10,
      position: 0.5,
      pickZoneType: "KYLT",
    }),

    createArticle({
      articleNumber: "FRY-A",
      frequency: 10,
      weight: 1,
      position: 0.5,
      pickZoneType: "FRYS",
    }),
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  assert.equal(result.length, 2);

  assert.equal(
    result[0].frequencyScore,
    1,
  );

  assert.equal(
    result[1].frequencyScore,
    1,
  );
});

test("ignores articles without complete placement data", () => {
  const articles = [
    {
      articleNumber: "A",
      articleFound: true,
      weightKg: 5,
      pickFrequency: 100,
      positionedPickLocations: [],
    },
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  assert.deepEqual(result, []);
});