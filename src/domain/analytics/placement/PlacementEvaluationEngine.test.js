import test from "node:test";
import assert from "node:assert/strict";

import {
  PlacementEvaluationEngine,
} from "./PlacementEvaluationEngine.js";

function createArticle({
  articleNumber,
  frequency,
  weight,
  averageQuantityPerPick = 1,
  position,
  pickZoneType = "KYLT",
}) {
  return {
    articleNumber,

    articleFound: true,

    pickFrequency:
      frequency,

    weightKg:
      weight,

    averageQuantityPerPick,

    positionedPickLocations: [
      {
        relativePickPosition:
          position,

        location: {
          pickZoneType,
        },
      },
    ],
  };
}

test("evaluates placement using frequency and handled weight", () => {
  const articles = [
    createArticle({
      articleNumber: "A",
      frequency: 100,
      weight: 10,
      averageQuantityPerPick: 2,
      position: 0.9,
    }),

    createArticle({
      articleNumber: "B",
      frequency: 10,
      weight: 1,
      averageQuantityPerPick: 1,
      position: 0.1,
    }),
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  const articleA =
    result.find(
      (item) =>
        item.articleNumber === "A",
    );

  assert.equal(
    articleA.averageHandledWeightPerPick,
    20,
  );

  assert.equal(
    articleA.frequencyScore,
    1,
  );

  assert.equal(
    articleA.handlingScore,
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

test("uses actual frequency magnitude instead of rank percentile", () => {
  const articles = [
    createArticle({
      articleNumber: "HIGH",
      frequency: 100,
      weight: 1,
      position: 0.5,
    }),

    createArticle({
      articleNumber: "LOW",
      frequency: 7,
      weight: 1,
      position: 0.5,
    }),
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  const high =
    result.find(
      (item) =>
        item.articleNumber ===
        "HIGH",
    );

  const low =
    result.find(
      (item) =>
        item.articleNumber ===
        "LOW",
    );

  assert.equal(
    high.frequencyScore,
    1,
  );

  assert.ok(
    low.frequencyScore < 0.5,
  );

  assert.ok(
    low.frequencyScore > 0,
  );
});

test("handling score considers average quantity per pick", () => {
  const articles = [
    createArticle({
      articleNumber: "MULTI",
      frequency: 10,
      weight: 2,
      averageQuantityPerPick: 6,
      position: 0.5,
    }),

    createArticle({
      articleNumber: "SINGLE",
      frequency: 10,
      weight: 2,
      averageQuantityPerPick: 1,
      position: 0.5,
    }),
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  const multi =
    result.find(
      (item) =>
        item.articleNumber ===
        "MULTI",
    );

  const single =
    result.find(
      (item) =>
        item.articleNumber ===
        "SINGLE",
    );

  assert.equal(
    multi.averageHandledWeightPerPick,
    12,
  );

  assert.equal(
    single.averageHandledWeightPerPick,
    2,
  );

  assert.equal(
    multi.handlingScore,
    1,
  );

  assert.ok(
    single.handlingScore <
      multi.handlingScore,
  );
});

test("normalizes articles independently within each pick zone", () => {
  const articles = [
    createArticle({
      articleNumber: "KYL-A",
      frequency: 100,
      weight: 10,
      averageQuantityPerPick: 2,
      position: 0.5,
      pickZoneType: "KYLT",
    }),

    createArticle({
      articleNumber: "FRY-A",
      frequency: 10,
      weight: 1,
      averageQuantityPerPick: 1,
      position: 0.5,
      pickZoneType: "FRYS",
    }),
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  assert.equal(
    result.length,
    2,
  );

  assert.equal(
    result[0].frequencyScore,
    1,
  );

  assert.equal(
    result[1].frequencyScore,
    1,
  );

  assert.equal(
    result[0].handlingScore,
    1,
  );

  assert.equal(
    result[1].handlingScore,
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
      averageQuantityPerPick: 2,
      positionedPickLocations: [],
    },
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  assert.deepEqual(
    result,
    [],
  );
});

test("ignores articles without average quantity per pick", () => {
  const articles = [
    {
      articleNumber: "A",
      articleFound: true,
      weightKg: 5,
      pickFrequency: 100,

      positionedPickLocations: [
        {
          relativePickPosition: 0.5,

          location: {
            pickZoneType: "KYLT",
          },
        },
      ],
    },
  ];

  const result =
    PlacementEvaluationEngine.evaluate(
      articles,
    );

  assert.deepEqual(
    result,
    [],
  );
});

test("rejects evaluation weights that do not sum to one", () => {
  assert.throws(
    () =>
      PlacementEvaluationEngine.evaluate(
        [],
        {
          frequencyWeight: 0.8,
          handlingWeight: 0.3,
        },
      ),
    /must sum to 1/i,
  );
});