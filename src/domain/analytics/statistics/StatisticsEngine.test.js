import test from "node:test";
import assert from "node:assert/strict";

import { StatisticsEngine } from "./StatisticsEngine.js";
import { PickHistoryRecord } from "../history/PickHistoryRecord.js";

test("calculates statistics for multiple articles", () => {
  const history = [
    new PickHistoryRecord({
      postingDate: new Date("2026-01-05"),
      documentNumber: "UT100",
      articleNumber: "33300",
      pickedQuantity: 2,
    }),

    new PickHistoryRecord({
      postingDate: new Date("2026-01-06"),
      documentNumber: "UT101",
      articleNumber: "33300",
      pickedQuantity: 3,
    }),

    new PickHistoryRecord({
      postingDate: new Date("2026-01-07"),
      documentNumber: "UT102",
      articleNumber: "118234",
      pickedQuantity: 4,
    }),
  ];

  const statistics = StatisticsEngine.calculate(history, {
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
  });

  assert.equal(statistics.length, 2);

  const article33300 = statistics.find(
    (stats) => stats.articleNumber === "33300",
  );

  assert.equal(article33300.pickFrequency, 2);
  assert.equal(article33300.pickedQuantity, 5);
  assert.equal(article33300.averageQuantityPerPick, 2.5);
});

test("counts duplicate document and article combination as one pick", () => {
  const history = [
    new PickHistoryRecord({
      postingDate: new Date("2026-01-05"),
      documentNumber: "UT100",
      articleNumber: "33300",
      pickedQuantity: 2,
    }),

    new PickHistoryRecord({
      postingDate: new Date("2026-01-05"),
      documentNumber: "UT100",
      articleNumber: "33300",
      pickedQuantity: 3,
    }),
  ];

  const [statistics] = StatisticsEngine.calculate(history, {
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
  });

  assert.equal(statistics.pickFrequency, 1);
  assert.equal(statistics.pickedQuantity, 5);
});

test("ignores records outside the selected period", () => {
  const history = [
    new PickHistoryRecord({
      postingDate: new Date("2025-12-31"),
      documentNumber: "UT099",
      articleNumber: "33300",
      pickedQuantity: 10,
    }),

    new PickHistoryRecord({
      postingDate: new Date("2026-01-05"),
      documentNumber: "UT100",
      articleNumber: "33300",
      pickedQuantity: 2,
    }),
  ];

  const [statistics] = StatisticsEngine.calculate(history, {
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
  });

  assert.equal(statistics.pickFrequency, 1);
  assert.equal(statistics.pickedQuantity, 2);
});

test("returns an empty array for empty history", () => {
  const statistics = StatisticsEngine.calculate([], {
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
  });

  assert.deepEqual(statistics, []);
});