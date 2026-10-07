import test from "node:test";
import assert from "node:assert/strict";
import { PickTimeAnalysisEngine } from "./PickTimeAnalysisEngine.js";

test("builds observed order sequences and estimates weekly time", () => {
  const positions = [0, .2, .8];
  const elapsedSeconds = [0, 12, 48];
  const articles = ["A", "B", "C"].map((articleNumber, index) => ({ articleNumber, positionedPickLocations: [{ relativePickPosition: positions[index], location: { pickZoneType: "KOLONIAL" } }] }));
  const records = Array.from({ length: 20 }, (_, order) => ["A", "B", "C"].map((articleNumber, index) => ({ orderNumber: `O${order}`, worker: "W", articleNumber, occurredAt: new Date(2026, 8, 14, 8, order, elapsedSeconds[index]) }))).flat();
  const evaluations = [{ articleNumber: "C", currentPosition: .8, desiredPosition: .3, placementGap: .5 }];
  const result = PickTimeAnalysisEngine.analyze({ movementRecords: records, positionedArticles: articles, evaluations, movementThreshold: .2 });
  assert.equal(result.orders, 20);
  assert.equal(result.transitions, 40);
  assert.equal(result.available, true);
  assert.ok(result.currentSecondsPerWeek > result.optimizedSecondsPerWeek);
});

test("uses the WMS source location for the observed route when a pick sequence is available", () => {
  const records = [
    { orderNumber: "O1", worker: "W", articleNumber: "A", sourceLocation: "010010101", occurredAt: new Date("2026-09-14T08:00:00") },
    { orderNumber: "O1", worker: "W", articleNumber: "B", sourceLocation: "010030101", occurredAt: new Date("2026-09-14T08:00:30") },
  ];
  const articles = [
    { articleNumber: "A", positionedPickLocations: [{ relativePickPosition: 0.5, location: { pickZoneType: "KOLONIAL" } }] },
    { articleNumber: "B", positionedPickLocations: [{ relativePickPosition: 0.5, location: { pickZoneType: "FRYS" } }] },
  ];
  const pickSequence = [
    { location: { locationCode: "010010101", pickZoneType: "KOLONIAL" }, relativePickPosition: 0.1 },
    { location: { locationCode: "010030101", pickZoneType: "KOLONIAL" }, relativePickPosition: 0.9 },
  ];

  const result = PickTimeAnalysisEngine.analyze({ movementRecords: records, positionedArticles: articles, pickSequence });

  assert.equal(result.transitions, 1);
  assert.equal(result.backtrackRate, 0);
});
