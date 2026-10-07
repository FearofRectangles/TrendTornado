import test from "node:test";
import assert from "node:assert/strict";
import { RelocationBundleEngine } from "./RelocationBundleEngine.js";

test("creates an atomic pair when joint movement improves a route but a solo move does not", () => {
  const location = { pickZoneType: "KOLONIAL" };
  const positionedArticles = [
    { articleNumber: "A", positionedPickLocations: [{ relativePickPosition: .8, location }] },
    { articleNumber: "B", positionedPickLocations: [{ relativePickPosition: .85, location }] },
    { articleNumber: "C", positionedPickLocations: [{ relativePickPosition: .2, location }] },
  ];
  const evaluations = [
    { articleNumber: "A", currentPosition: .8, desiredPosition: .2, placementGap: .6, frequencyScore: 1 },
    { articleNumber: "B", currentPosition: .85, desiredPosition: .25, placementGap: .6, frequencyScore: 1 },
  ];
  const records = [];
  for (let order = 0; order < 10; order += 1) {
    const base = new Date(2026, 8, 1, 8, order, 0);
    records.push(
      { orderNumber: `O${order}`, worker: "W", articleNumber: "A", occurredAt: base },
      { orderNumber: `O${order}`, worker: "W", articleNumber: "B", occurredAt: new Date(base.getTime() + 10000) },
      { orderNumber: `O${order}`, worker: "W", articleNumber: "C", occurredAt: new Date(base.getTime() + 20000) },
    );
  }
  const bundles = RelocationBundleEngine.analyze({ movementRecords: records, positionedArticles, evaluations, movementThreshold: .2, secondsPerFullSpan: 60 });
  assert.equal(bundles.length, 1);
  assert.deepEqual(bundles[0].articleNumbers, ["A", "B"]);
  assert.ok(bundles[0].jointSpanDelta < 0);
  assert.ok(bundles[0].soloSpanDelta.A > 0 || bundles[0].soloSpanDelta.B > 0);
});
