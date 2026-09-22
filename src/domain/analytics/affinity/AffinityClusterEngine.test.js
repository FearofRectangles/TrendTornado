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

{
  const denseProfiles = new Map(["A", "B", "C", "D", "E"].map((articleNumber, index) => [
    articleNumber,
    { articleNumber, pickZone: "KOLONIAL", currentPosition: index / 4, priorityScore: 0.8 },
  ]));
  const denseRecords = [];
  let document = 0;
  const addPair = (left, right) => {
    for (let occurrence = 0; occurrence < 10; occurrence += 1) {
      document += 1;
      denseRecords.push({ articleNumber: left, documentNumber: `UT-${document}` });
      denseRecords.push({ articleNumber: right, documentNumber: `UT-${document}` });
    }
  };
  for (const [left, right] of [["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"], ["A", "E"], ["B", "E"]]) addPair(left, right);
  const denseResult = AffinityClusterEngine.analyze({
    historyRecords: denseRecords,
    profilesByArticle: denseProfiles,
    minimumCommonOrders: 10,
    minimumAffinity: 0.15,
  });
  const largest = denseResult.clusters.toSorted((a, b) => b.articleNumbers.length - a.articleNumbers.length)[0];
  assert.deepEqual(new Set(largest.articleNumbers), new Set(["A", "B", "C", "D"]));
  assert.ok(largest.associatedArticleNumbers.includes("E"));
  assert.equal(denseResult.clusters.filter((cluster) => cluster.articleNumbers.length === 4).length, 1);
}
