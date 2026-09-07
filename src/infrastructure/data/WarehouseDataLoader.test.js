import test from "node:test";
import assert from "node:assert/strict";
import { mergeHistoryRecordSources } from "./WarehouseDataLoader.js";

function record(documentNumber, articleNumber) {
  return { documentNumber, articleNumber };
}

test("merges non-overlapping history sources", () => {
  const result = mergeHistoryRecordSources([
    { path: "week-1.csv", records: [record("UT1", "A")], rows: [{}] },
    { path: "week-2.csv", records: [record("UT2", "B")], rows: [{}] },
  ]);
  assert.equal(result.records.length, 2);
  assert.equal(result.duplicateDocuments, 0);
  assert.equal(result.sources[1].includedRecords, 1);
});

test("keeps the first complete document when later sources overlap", () => {
  const result = mergeHistoryRecordSources([
    {
      path: "week-1.csv",
      records: [record("UT1", "A"), record("UT1", "B")],
      rows: [{}, {}],
    },
    {
      path: "week-2.csv",
      records: [record("UT1", "A"), record("UT1", "B"), record("UT2", "C")],
      rows: [{}, {}, {}],
    },
  ]);
  assert.deepEqual(result.records.map((item) => item.documentNumber), ["UT1", "UT1", "UT2"]);
  assert.equal(result.duplicateDocuments, 1);
  assert.equal(result.duplicateRecords, 2);
  assert.equal(result.sources[1].includedRecords, 1);
});
