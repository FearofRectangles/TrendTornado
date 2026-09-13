import assert from "node:assert/strict";
import { PickHistoryRecord } from "../history/PickHistoryRecord.js";
import { AbcXyzClassificationEngine, weekKey } from "./AbcXyzClassificationEngine.js";

function record(articleNumber, documentNumber, date) {
  return new PickHistoryRecord({ articleNumber, documentNumber, postingDate: new Date(date), pickedQuantity: 1 });
}

{
  const records = [];
  for (let week = 1; week <= 13; week += 1) {
    const date = new Date(2025, 0, 6 + ((week - 1) * 7));
    records.push(record("AX", `UT-AX-${week}`, date));
    if (week <= 7) records.push(record("BY", `UT-BY-${week}`, date));
    if (week === 1) records.push(record("CZ", "UT-CZ-1", date));
  }
  const result = AbcXyzClassificationEngine.analyze(records, { aThreshold: 0.5, bThreshold: 0.9 });
  assert.equal(result.observedWeekCount, 13);
  assert.equal(result.quality, "STRONG");
  assert.equal(result.byArticle.get("AX").xyzClass, "X");
  assert.equal(result.byArticle.get("BY").xyzClass, "Y");
  assert.equal(result.byArticle.get("CZ").xyzClass, "Z");
  assert.equal(result.byArticle.get("AX").abcClass, "A");
  assert.deepEqual(result.byArticle.get("CZ").xyz.weeklyPickStops.filter(Boolean), [1]);
}

{
  const result = AbcXyzClassificationEngine.analyze([
    record("1", "UT-1", "2025-01-01"),
    record("1", "UT-2", "2025-01-08"),
  ]);
  assert.equal(result.quality, "INSUFFICIENT");
  assert.equal(result.byArticle.get("1").classification, "A–");
}

assert.equal(weekKey(new Date("2025-12-31")), "2026-W01");
console.log("AbcXyzClassificationEngine tests passed");
