import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPhysicalZoneSequence,
} from "./BuildPhysicalZoneSequence.js";

import {
  Location,
} from "../../domain/warehouse/location/Location.js";

import {
  LocationPurpose,
} from "../../domain/shared/LocationPurpose.js";

import {
  ZoneSection,
} from "../../domain/warehouse/zone/ZoneSection.js";

test("builds physical position from unique bays", () => {
  const locations = [
    new Location({
      locationCode: "010030101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010010101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010020101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const result =
    buildPhysicalZoneSequence(
      locations,
    );

  const byLocationCode =
    new Map(
      result.map((item) => [
        item.location.locationCode,
        item,
      ]),
    );

  const first =
    byLocationCode.get(
      "010010101",
    );

  const middle =
    byLocationCode.get(
      "010020101",
    );

  const last =
    byLocationCode.get(
      "010030101",
    );

  assert.equal(
    first.baySequence,
    1,
  );

  assert.equal(
    first.totalZoneBays,
    3,
  );

  assert.equal(
    first.relativeZonePosition,
    0,
  );

  assert.equal(
    first.zoneSection,
    ZoneSection.BEGINNING,
  );

  assert.equal(
    middle.baySequence,
    2,
  );

  assert.equal(
    middle.relativeZonePosition,
    0.5,
  );

  assert.equal(
    middle.zoneSection,
    ZoneSection.MIDDLE,
  );

  assert.equal(
    last.baySequence,
    3,
  );

  assert.equal(
    last.relativeZonePosition,
    1,
  );

  assert.equal(
    last.zoneSection,
    ZoneSection.END,
  );
});

test("locations in the same bay receive the same physical position", () => {
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
      locationCode: "010010202",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010020101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "010030101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const result =
    buildPhysicalZoneSequence(
      locations,
    );

  const bay001 =
    result.filter(
      (item) =>
        item.bay === "001",
    );

  assert.equal(
    bay001.length,
    3,
  );

  for (const item of bay001) {
    assert.equal(
      item.baySequence,
      1,
    );

    assert.equal(
      item.relativeZonePosition,
      0,
    );

    assert.equal(
      item.zoneSection,
      ZoneSection.BEGINNING,
    );
  }
});

test("uses bay order rather than numeric gaps between bay codes", () => {
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
      locationCode: "010100101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const result =
    buildPhysicalZoneSequence(
      locations,
    );

  const bay010 =
    result.find(
      (item) =>
        item.bay === "010",
    );

  // Even though the bay number jumps from 002 to 010,
  // it is still simply the third physical bay.
  assert.equal(
    bay010.baySequence,
    3,
  );

  assert.equal(
    bay010.relativeZonePosition,
    1,
  );
});

test("builds separate bay sequences for physical zones", () => {
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
      locationCode: "020010101",
      purpose: LocationPurpose.PICK,
    }),

    new Location({
      locationCode: "020020101",
      purpose: LocationPurpose.PICK,
    }),
  ];

  const result =
    buildPhysicalZoneSequence(
      locations,
    );

  const zone01 =
    result.filter(
      (item) =>
        item.zone === "01",
    );

  const zone02 =
    result.filter(
      (item) =>
        item.zone === "02",
    );

  assert.equal(
    zone01[0].totalZoneBays,
    2,
  );

  assert.equal(
    zone02[0].totalZoneBays,
    2,
  );

  assert.equal(
    zone01[0].baySequence,
    1,
  );

  assert.equal(
    zone02[0].baySequence,
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

  const result =
    buildPhysicalZoneSequence(
      locations,
    );

  assert.equal(
    result.length,
    2,
  );

  assert.equal(
    result[0].totalZoneBays,
    2,
  );

  assert.equal(
    result[1].totalZoneBays,
    2,
  );
});