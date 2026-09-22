import test from "node:test";
import assert from "node:assert/strict";

import {
  enrichArticleStatistics,
} from "./EnrichArticleStatistics.js";

test("enriches article statistics with article data", () => {
  const statistics = [
    {
      articleNumber: "33300",
      pickFrequency: 10,
      pickedQuantity: 25,
      averageQuantityPerPick: 2.5,
    },
  ];

  const articles = [
    {
      articleNumber: "33300",
      name: "3-Mixbönor EKO 2,6kg",
      weightKg: 2.6,
      temperatureZone: "KOL",
      category: null,
      baseUnit: "BURK",
      heightCm: 21,
      widthCm: 17,
      depthCm: 17,
    },
  ];

  const result = enrichArticleStatistics(
    statistics,
    articles,
  );

  assert.equal(result.length, 1);

  assert.equal(
    result[0].articleNumber,
    "33300",
  );

  assert.equal(
    result[0].name,
    "3-Mixbönor EKO 2,6kg",
  );

  assert.equal(result[0].weightKg, 2.6);
  assert.equal(result[0].baseUnit, "BURK");
  assert.deepEqual([result[0].heightCm, result[0].widthCm, result[0].depthCm], [21, 17, 17]);
  assert.equal(
    result[0].temperatureZone,
    "KOL",
  );

  assert.equal(result[0].pickFrequency, 10);
  assert.equal(result[0].pickedQuantity, 25);

  assert.equal(
    result[0].averageQuantityPerPick,
    2.5,
  );

  assert.equal(result[0].articleFound, true);
});

test("keeps statistics when article data is missing", () => {
  const statistics = [
    {
      articleNumber: "999999",
      pickFrequency: 5,
      pickedQuantity: 10,
      averageQuantityPerPick: 2,
    },
  ];

  const result = enrichArticleStatistics(
    statistics,
    [],
  );

  assert.equal(result.length, 1);

  assert.equal(
    result[0].articleNumber,
    "999999",
  );

  assert.equal(result[0].name, null);
  assert.equal(result[0].weightKg, null);
  assert.equal(
    result[0].temperatureZone,
    null,
  );

  assert.equal(result[0].articleFound, false);
});

test("normalizes article numbers before matching", () => {
  const statistics = [
    {
      articleNumber: "43454",
      pickFrequency: 177,
      pickedQuantity: 1197,
      averageQuantityPerPick: 6.76,
    },
  ];

  const articles = [
    {
      articleNumber: " 43454 ",
      name: "Potatis Skalad Säck",
      weightKg: 7,
      temperatureZone: "KYL",
      category: null,
    },
  ];

  const result = enrichArticleStatistics(
    statistics,
    articles,
  );

  assert.equal(result[0].articleFound, true);
  assert.equal(
    result[0].name,
    "Potatis Skalad Säck",
  );
  assert.equal(result[0].weightKg, 7);
});
