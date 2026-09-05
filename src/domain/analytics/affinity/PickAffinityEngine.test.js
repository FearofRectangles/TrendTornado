import test from "node:test";
import assert from "node:assert/strict";
import { PickAffinityEngine } from "./PickAffinityEngine.js";

function record(documentNumber, articleNumber) {
  return { documentNumber, articleNumber };
}

test("calculates affinity from distinct documents and ignores duplicate rows", () => {
  const result = PickAffinityEngine.analyze({
    articleNumber: "A",
    minimumCommonOrders: 1,
    historyRecords: [
      record("1", "A"), record("1", "A"), record("1", "B"),
      record("2", "A"), record("2", "B"), record("2", "C"),
      record("3", "A"), record("3", "C"),
      record("4", "B"),
    ],
  });

  assert.equal(result.selectedOrderCount, 3);
  assert.deepEqual(result.partners, [
    { articleNumber: "B", commonOrderCount: 2, affinity: 2 / 3 },
    { articleNumber: "C", commonOrderCount: 2, affinity: 2 / 3 },
  ]);
});

test("filters weak coincidences and limits the result", () => {
  const result = PickAffinityEngine.analyze({
    articleNumber: "A",
    minimumCommonOrders: 2,
    limit: 1,
    historyRecords: [
      record("1", "A"), record("1", "B"), record("1", "C"),
      record("2", "A"), record("2", "B"),
    ],
  });
  assert.equal(result.partners.length, 1);
  assert.equal(result.partners[0].articleNumber, "B");
  assert.equal(result.partners[0].affinity, 1);
});
