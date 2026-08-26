import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPickSequence,
} from "./BuildPickSequence.js";

import {
  Location,
} from "../../domain/warehouse/location/Location.js";

import {
  LocationPurpose,
} from "../../domain/shared/LocationPurpose.js";

test("builds pick sequence within a pick zone", () => {
  const locations = [
    new Location({
      locationCode: "200030101",
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

  const sequence =
    buildPickSequence(locations);

  assert.equal(sequence.length, 3);

  assert.equal(
    sequence[0].location.locationCode,
    "200010101",
  );

  assert.equal(
    sequence[0].pickSequence,
    1,
  );

  assert.equal(
    sequence[0].relativePickPosition,
    0,
  );

  assert.equal(
    sequence[1].pickSequence,
    2,
  );

  assert.equal(
    sequence[1].relativePickPosition,
    0.5,
  );

  assert.equal(
    sequence[2].pickSequence,
    3,
  );

  assert.equal(
    sequence[2].relativePickPosition,
    1,
  );
});
test("builds separate sequences for different pick zones", () => {
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

  const sequence =
    buildPickSequence(locations);

  const colonial = sequence.filter(
    (item) =>
      item.pickZoneType === "KOLONIAL",
  );

  const vegetables = sequence.filter(
    (item) =>
      item.pickZoneType === "GRÖNSAKER",
  );

  assert.equal(colonial.length, 2);
  assert.equal(vegetables.length, 2);

  assert.equal(
    colonial[0].pickSequence,
    1,
  );

  assert.equal(
    vegetables[0].pickSequence,
    1,
  );

  assert.equal(
    colonial[1].relativePickPosition,
    1,
  );

  assert.equal(
    vegetables[1].relativePickPosition,
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

    new Location({
      locationCode: "010030101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const sequence =
    buildPickSequence(locations);

  assert.equal(sequence.length, 2);

  assert.equal(
    sequence[0].pickSequence,
    1,
  );

  assert.equal(
    sequence[1].pickSequence,
    2,
  );
});