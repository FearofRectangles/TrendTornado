import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBayFlow,
} from "./BuildBayFlow.js";

import {
  Location,
} from "../../domain/warehouse/location/Location.js";

import {
  LocationPurpose,
} from "../../domain/shared/LocationPurpose.js";

test("builds one flow entry per unique bay", () => {
  const locations = [
    new Location({
      locationCode: "010010101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010010201",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010020101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const result =
    buildBayFlow(locations);

  assert.equal(
    result.length,
    2,
  );

  assert.equal(
    result[0].zone,
    "01",
  );

  assert.equal(
    result[0].bay,
    "001",
  );

  assert.equal(
    result[0].sequence,
    1,
  );

  assert.equal(
    result[1].bay,
    "002",
  );

  assert.equal(
    result[1].sequence,
    2,
  );
});

test("builds bay flow across physical zones in picking order", () => {
  const locations = [
    new Location({
      locationCode: "020020101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010020101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "020010101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010010101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const result =
    buildBayFlow(locations);

  assert.deepEqual(
    result.map(
      (item) =>
        `${item.zone}-${item.bay}`,
    ),
    [
      "01-001",
      "01-002",
      "02-001",
      "02-002",
    ],
  );

  assert.equal(
    result[0].relativePosition,
    0,
  );

  assert.equal(
    result[3].relativePosition,
    1,
  );
});

test("keeps different pick zones in separate flows", () => {
  const locations = [
    new Location({
      locationCode: "010010101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010020101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "200010101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "200020101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const result =
    buildBayFlow(locations);

  const colonial =
    result.filter(
      (item) =>
        item.pickZoneType ===
        "KOLONIAL",
    );

  const vegetables =
    result.filter(
      (item) =>
        item.pickZoneType ===
        "GRÖNSAKER",
    );

  assert.equal(
    colonial.length,
    2,
  );

  assert.equal(
    vegetables.length,
    2,
  );

  assert.equal(
    colonial[0].sequence,
    1,
  );

  assert.equal(
    vegetables[0].sequence,
    1,
  );
});

test("ignores buffer locations", () => {
  const locations = [
    new Location({
      locationCode: "010010101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010020101",
      purpose: LocationPurpose.BUFFER,
    }),
  ];

  const result =
    buildBayFlow(locations);

  assert.equal(
    result.length,
    1,
  );

  assert.equal(
    result[0].bay,
    "001",
  );
});