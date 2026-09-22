import assert from "node:assert/strict";
import { Location } from "../../domain/warehouse/location/Location.js";
import { LocationPurpose } from "../../domain/shared/LocationPurpose.js";
import { buildShelfHeights } from "./BuildShelfHeights.js";

const make = (locationCode, heightCm, widthCm = 100, depthCm = 80) => new Location({ locationCode, purpose: LocationPurpose.PICK, heightCm, widthCm, depthCm });
const result = buildShelfHeights([
  make("020030101", 110),
  make("020030201", 60),
  make("020030202", 55),
  make("020030301", 80),
], { beamThicknessCm: 12 });
assert.equal(result.get("020030101").floorHeightCm, 0);
assert.equal(result.get("020030201").floorHeightCm, 122);
assert.equal(result.get("020030202").floorHeightCm, 122);
assert.equal(result.get("020030301").floorHeightCm, 194);
assert.equal(result.get("020030301").topHeightCm, 274);
assert.equal(result.get("020030301").volumeM3, 0.64);
console.log("BuildShelfHeights tests passed");
