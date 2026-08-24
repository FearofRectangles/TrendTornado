import test from "node:test";
import assert from "node:assert/strict";

import { validatePickHistoryRows } from "./ValidatePickHistory.js";

test("validates mixed pick history rows correctly", () => {
  const rows = [
    {
      Dokumentnr: "UT100",
      Artikelnr: "33300",
      Artikelbeskrivning: "Normal artikel",
      Antal: "-2.",
    },
    {
      Dokumentnr: "UT101",
      Artikelnr: "99134",
      Artikelbeskrivning: "Retur SRS back",
      Antal: "-1.",
    },
    {
      Dokumentnr: "IN100",
      Artikelnr: "33300",
      Artikelbeskrivning: "Normal artikel",
      Antal: "5.",
    },
    {
      Dokumentnr: "UT102",
      Artikelnr: "118234",
      Artikelbeskrivning: "Normal artikel",
      Antal: "banana",
    },
  ];

  const result = validatePickHistoryRows(rows);

  assert.equal(result.totalRows, 4);
  assert.equal(result.validRows, 1);
  assert.equal(result.excludedArticles, 1);
  assert.equal(result.invalidDocuments, 1);
  assert.equal(result.invalidQuantities, 1);
});

test("builds excluded article breakdown", () => {
  const rows = [
    {
      Dokumentnr: "UT100",
      Artikelnr: "99134",
      Artikelbeskrivning: "Retur SRS back",
      Antal: "-1.",
    },
    {
      Dokumentnr: "UT101",
      Artikelnr: "99134",
      Artikelbeskrivning: "Retur SRS back",
      Antal: "-1.",
    },
  ];

  const result = validatePickHistoryRows(rows);

  const excluded = result.excludedArticleBreakdown.get("99134");

  assert.equal(result.excludedArticles, 2);
  assert.equal(excluded.articleNumber, "99134");
  assert.equal(excluded.description, "Retur SRS back");
  assert.equal(excluded.count, 2);
});

test("accounts for every input row", () => {
  const rows = [
    {
      Dokumentnr: "UT100",
      Artikelnr: "33300",
      Antal: "-2.",
    },
    {
      Dokumentnr: "UT101",
      Artikelnr: "7629",
      Artikelbeskrivning: "Rullbur kolonial",
      Antal: "-1.",
    },
    {
      Dokumentnr: "OTHER100",
      Artikelnr: "33300",
      Antal: "2.",
    },
  ];

  const result = validatePickHistoryRows(rows);

  const accountedRows =
    result.validRows +
    result.excludedArticles +
    result.invalidDocuments +
    result.invalidQuantities;

  assert.equal(accountedRows, result.totalRows);
});

test("tracks valid rows by date", () => {
  const rows = [
    {
      Bokföringsdatum: "8/25/25",
      Dokumentnr: "UT100",
      Artikelnr: "33300",
      Antal: "-2.",
    },
    {
      Bokföringsdatum: "8/25/25",
      Dokumentnr: "UT101",
      Artikelnr: "118234",
      Antal: "-1.",
    },
    {
      Bokföringsdatum: "8/26/25",
      Dokumentnr: "UT102",
      Artikelnr: "33300",
      Antal: "-3.",
    },

    // Ska INTE räknas
    {
      Bokföringsdatum: "8/26/25",
      Dokumentnr: "UT103",
      Artikelnr: "99134",
      Antal: "-1.",
    },
  ];

  const result = validatePickHistoryRows(rows);

  assert.equal(result.dateCoverage.get("8/25/25"), 2);
  assert.equal(result.dateCoverage.get("8/26/25"), 1);
});