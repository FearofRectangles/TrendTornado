import test from "node:test";
import assert from "node:assert/strict";

import { buildArticleStatistics } from "./BuildArticleStatistics.js";

test("builds article statistics from raw history rows", () => {

  const rows = [
    {
      Bokföringsdatum: "8/1/25",
      Dokumentnr: "UT100",
      Artikelnr: "33300",
      Antal: "-2.",
    },
    {
      Bokföringsdatum: "8/2/25",
      Dokumentnr: "UT101",
      Artikelnr: "33300",
      Antal: "-3.",
    },
    {
      Bokföringsdatum: "8/3/25",
      Dokumentnr: "UT102",
      Artikelnr: "118234",
      Antal: "-4.",
    },
  ];

  const statistics = buildArticleStatistics(rows, {
    periodStart: new Date(2025, 7, 1),
    periodEnd: new Date(2025, 7, 31, 23, 59, 59, 999),
  });

  assert.equal(statistics.length, 2);

  const article33300 = statistics.find(
    (stats) => stats.articleNumber === "33300",
  );

  assert.equal(article33300.pickFrequency, 2);
  assert.equal(article33300.pickedQuantity, 5);
});

test("filters excluded and non-outbound rows before analysis", () => {
  const rows = [
    {
      Bokföringsdatum: "8/1/25",
      Dokumentnr: "UT100",
      Artikelnr: "33300",
      Antal: "-2.",
    },
    {
      Bokföringsdatum: "8/1/25",
      Dokumentnr: "IN100",
      Artikelnr: "33300",
      Antal: "20.",
    },
    {
      Bokföringsdatum: "8/1/25",
      Dokumentnr: "UT101",
      Artikelnr: "134194",
      Antal: "-1.",
    },
  ];

  const statistics = buildArticleStatistics(rows, {
    periodStart: new Date(2025, 7, 1),
    periodEnd: new Date(2025, 7, 31, 23, 59, 59, 999),
  });

  assert.equal(statistics.length, 1);
  assert.equal(statistics[0].articleNumber, "33300");
  assert.equal(statistics[0].pickedQuantity, 2);
});