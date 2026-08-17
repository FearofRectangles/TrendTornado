import test from "node:test";
import assert from "node:assert/strict";

import { mapPickHistoryCsvRow } from "./PickHistoryCsvMapper.js";
import { PickHistoryRecord } from "../../../domain/analytics/history/PickHistoryRecord.js";

test("maps an outbound history row to PickHistoryRecord", () => {
  const row = {
    Bokföringsdatum: "8/30/25",
    Dokumentnr: "UT121519195",
    Artikelnr: "114022",
    Antal: "-5.",
  };

  const record = mapPickHistoryCsvRow(row);

  assert.ok(record instanceof PickHistoryRecord);
  assert.equal(record.documentNumber, "UT121519195");
  assert.equal(record.articleNumber, "114022");
  assert.equal(record.pickedQuantity, 5);

  assert.equal(record.postingDate.getFullYear(), 2025);
  assert.equal(record.postingDate.getMonth(), 7);
  assert.equal(record.postingDate.getDate(), 30);
});

test("ignores rows that are not outbound documents", () => {
  const row = {
    Bokföringsdatum: "8/30/25",
    Dokumentnr: "IN123456",
    Artikelnr: "114022",
    Antal: "5",
  };

  const record = mapPickHistoryCsvRow(row);

  assert.equal(record, null);
});

test("normalizes negative quantity to positive picked quantity", () => {
  const row = {
    Bokföringsdatum: "8/30/25",
    Dokumentnr: "UT100",
    Artikelnr: "33300",
    Antal: "-12.",
  };

  const record = mapPickHistoryCsvRow(row);

  assert.equal(record.pickedQuantity, 12);
});

test("rejects invalid quantity", () => {
  const row = {
    Bokföringsdatum: "8/30/25",
    Dokumentnr: "UT100",
    Artikelnr: "33300",
    Antal: "banana",
  };

  assert.throws(
    () => mapPickHistoryCsvRow(row),
    /invalid quantity/i,
  );
});

test("ignores rullbur articles", () => {
  const row = {
    Bokföringsdatum: "8/30/25",
    Dokumentnr: "UT121519195",
    Artikelnr: "134194",
    Antal: "-1.",
  };

  assert.equal(mapPickHistoryCsvRow(row), null);
});

test("maps a real outbound article row", () => {
  const row = {
    Bokföringsdatum: "8/30/25",
    Dokumentnr: "UT121519196",
    Artikelnr: "126925",
    Antal: "-1.",
  };

  const record = mapPickHistoryCsvRow(row);

  assert.equal(record.articleNumber, "126925");
  assert.equal(record.documentNumber, "UT121519196");
  assert.equal(record.pickedQuantity, 1);
});

test("does not exclude normal article 33300", () => {
  const row = {
    Bokföringsdatum: "8/1/25",
    Dokumentnr: "UT100",
    Artikelnr: "33300",
    Antal: "-2.",
  };

  const record = mapPickHistoryCsvRow(row);

  assert.notEqual(record, null);
  assert.equal(record.articleNumber, "33300");
});