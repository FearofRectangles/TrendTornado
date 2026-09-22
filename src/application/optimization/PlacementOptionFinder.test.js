import assert from "node:assert/strict";
import { createPlacementOptionFinder, fitArticle } from "./PlacementOptionFinder.js";

const article = { articleNumber: "A", name: "A", heightCm: 20, widthCm: 30, depthCm: 40, baseUnit: "ST" };
assert.equal(fitArticle(article, { heightCm: 25, widthCm: 40, depthCm: 30 }).fits, true);
assert.equal(fitArticle(article, { heightCm: 15, widthCm: 40, depthCm: 30 }).fits, false);

const location = (locationCode, heightCm, widthCm = 40, depthCm = 40) => ({
  locationCode, heightCm, widthCm, depthCm, isPickLocation: true, pickZoneType: "KOLONIAL",
  zone: locationCode.slice(0, 2), bay: locationCode.slice(2, 5), shelf: locationCode.slice(5, 7),
});
const current = location("010010101", 30);
const direct = location("010020101", 30);
const short = location("010030101", 15);
const above = location("010030201", 30);
const find = createPlacementOptionFinder({
  locations: [current, direct, short, above], placements: [],
  pickSequence: [current, direct, short, above].map((item, index) => ({ location: item, relativePickPosition: index / 3 })),
  weeklyQuantityByArticle: new Map([["A", 7]]), maximumBeamAdjustmentCm: 10,
});
const result = find({ article, currentLocation: current, desiredPosition: 0.4 });
assert.equal(result.direct[0].locationCode, direct.locationCode);
assert.equal(result.adjustments[0].locationCode, short.locationCode);
assert.equal(result.adjustments[0].adjustmentCm, 5);
console.log("PlacementOptionFinder tests passed");
