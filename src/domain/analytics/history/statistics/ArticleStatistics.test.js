import test from "node:test";
import assert from "node:assert/strict";

import { ArticleStatistics } from "./ArticleStatistics.js";

test("creates valid article statistics", () => {
  const statistics = new ArticleStatistics({
    articleNumber: "33300",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    pickFrequency: 100,
    pickedQuantity: 250,
  });

  assert.equal(statistics.articleNumber, "33300");
  assert.equal(statistics.pickFrequency, 100);
  assert.equal(statistics.pickedQuantity, 250);
});

test("calculates average quantity per pick", () => {
  const statistics = new ArticleStatistics({
    articleNumber: "33300",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    pickFrequency: 100,
    pickedQuantity: 250,
  });

  assert.equal(statistics.averageQuantityPerPick, 2.5);
});

test("returns zero average when pick frequency is zero", () => {
  const statistics = new ArticleStatistics({
    articleNumber: "33300",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    pickFrequency: 0,
    pickedQuantity: 0,
  });

  assert.equal(statistics.averageQuantityPerPick, 0);
});

test("rejects invalid statistics period", () => {
  assert.throws(
    () =>
      new ArticleStatistics({
        articleNumber: "33300",
        periodStart: new Date("2026-02-01"),
        periodEnd: new Date("2026-01-01"),
        pickFrequency: 10,
        pickedQuantity: 20,
      }),
    /period start cannot be after period end/i,
  );
});

test("rejects negative pick frequency", () => {
  assert.throws(
    () =>
      new ArticleStatistics({
        articleNumber: "33300",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        pickFrequency: -1,
        pickedQuantity: 20,
      }),
    /pick frequency must be a non-negative integer/i,
  );
});