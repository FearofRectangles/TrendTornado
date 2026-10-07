import test from "node:test";
import assert from "node:assert/strict";

import { attachPickPlacements } from "./AttachPickPlacements.js";

test("attaches pick locations to article statistics", () => {
  const article = {
    articleNumber: "43454",
  };

  const location = {
    locationCode: "110010101",
  };

  const statistics = [
    {
      articleNumber: "43454",
      name: "Potatis Skalad Säck",
      weightKg: 7,
      pickFrequency: 177,
      pickedQuantity: 1197,
    },
  ];

  const placements = [
    {
      article,
      location,
    },
  ];

  const result = attachPickPlacements(
    statistics,
    placements,
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].pickLocations.length, 1);
  assert.equal(
    result[0].pickLocations[0].locationCode,
    "110010101",
  );
  assert.equal(result[0].placementEvidence.source, "PLACEMENT_SNAPSHOT");
  assert.equal(result[0].placementEvidence.confidence, "HIGH");
});

test("returns an empty location list when article has no pick placement", () => {
  const statistics = [
    {
      articleNumber: "43454",
      name: "Potatis Skalad Säck",
      weightKg: 7,
      pickFrequency: 177,
      pickedQuantity: 1197,
    },
  ];

  const result = attachPickPlacements(
    statistics,
    [],
  );

  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0].pickLocations,
    [],
  );
  assert.equal(result[0].placementEvidence.source, "NONE");
});

test("uses the latest valid WMS pick location when the placement snapshot has no article", () => {
  const early = new Date("2025-08-01T08:00:00");
  const late = new Date("2025-08-08T08:00:00");
  const locations = [
    { locationCode: "110010101", purpose: "PICK", isPickLocation: true },
    { locationCode: "110020101", purpose: "PICK", isPickLocation: true },
    { locationCode: "990010101", purpose: "BUFFER", isPickLocation: false },
  ];
  const result = attachPickPlacements(
    [{ articleNumber: "43454" }],
    [],
    {
      locations,
      movementRecords: [
        { articleNumber: "43454", sourceLocation: "110010101", occurredAt: early },
        { articleNumber: "43454", sourceLocation: "990010101", occurredAt: new Date("2025-08-10T08:00:00") },
        { articleNumber: "43454", sourceLocation: "110020101", occurredAt: late },
      ],
    },
  );

  assert.equal(result[0].pickLocations[0].locationCode, "110020101");
  assert.equal(result[0].placementEvidence.source, "WMS_HISTORY");
  assert.equal(result[0].placementEvidence.confidence, "MEDIUM");
  assert.equal(result[0].placementEvidence.observedAt, late);
});

test("keeps the placement snapshot ahead of a newer WMS observation", () => {
  const snapshotLocation = { locationCode: "110010101" };
  const result = attachPickPlacements(
    [{ articleNumber: "43454" }],
    [{ article: { articleNumber: "43454" }, location: snapshotLocation }],
    {
      locations: [{ locationCode: "110020101", purpose: "PICK", isPickLocation: true }],
      movementRecords: [{ articleNumber: "43454", sourceLocation: "110020101", occurredAt: new Date("2025-08-10T08:00:00") }],
    },
  );

  assert.equal(result[0].pickLocations[0], snapshotLocation);
  assert.equal(result[0].placementEvidence.source, "PLACEMENT_SNAPSHOT");
});
