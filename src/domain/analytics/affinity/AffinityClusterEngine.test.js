import assert from "node:assert/strict";
import { AffinityClusterEngine } from "./AffinityClusterEngine.js";

const profiles = new Map([
  ["F1", { articleNumber: "F1", pickZone: "FRYS", currentPosition: 0.1, priorityScore: 1 }],
  ["F2", { articleNumber: "F2", pickZone: "FRYS", currentPosition: 0.9, priorityScore: 1 }],
  ["K1", { articleNumber: "K1", pickZone: "KYLT", currentPosition: 0.9, priorityScore: 1 }],
]);
const records = [];
for (let order = 1; order <= 10; order += 1) {
  for (const articleNumber of ["F1", "F2", "K1"]) records.push({ articleNumber, documentNumber: `UT${order}` });
}
const result = AffinityClusterEngine.analyze({
  historyRecords: records,
  profilesByArticle: profiles,
  bayCountByPickZone: new Map([["FRYS", 101], ["KYLT", 50]]),
  minimumCommonOrders: 2,
});
assert.equal(result.relations.length, 1);
assert.equal(result.relations[0].pickZone, "FRYS");
assert.equal(result.relations[0].estimatedDistanceMeters, 80);
assert.deepEqual(result.clusters[0].articleNumbers.sort(), ["F1", "F2"]);
assert.equal(result.clusters[0].occurrenceCount, 10);
console.log("AffinityClusterEngine tests passed");
