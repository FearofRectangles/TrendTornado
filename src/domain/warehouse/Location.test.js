import assert from "node:assert/strict";
import test from "node:test";

import { Location } from "./location/Location.js";
import { TemperatureZone } from "../shared/TemperatureZone.js";
import { LocationPurpose } from "../shared/LocationPurpose.js";

test("creates a valid location and parses its code", () => {
  const location = new Location({
    locationCode: "010250201",
    temperatureZone: TemperatureZone.KOL,
    purpose: LocationPurpose.PICK,
  });

  assert.equal(location.locationCode, "010250201");
  assert.equal(location.zone, "01");
  assert.equal(location.bay, "025");
  assert.equal(location.shelf, "02");
  assert.equal(location.position, "01");
});

test("rejects an invalid location code", () => {
  assert.throws(
    () =>
      new Location({
        locationCode: "01025",
        temperatureZone: TemperatureZone.KOL,
      }),
    /9-digit string/i,
  );
});

test("keeps leading zeroes in the location code", () => {
  const location = new Location({
    locationCode: "010010101",
    temperatureZone: TemperatureZone.KOL,
    purpose: LocationPurpose.PICK,
  });

  assert.equal(location.locationCode, "010010101");
});

test("compares locations according to the picking loop", () => {
  const earlierLocation = new Location({
    locationCode: "010250101",
    temperatureZone: TemperatureZone.KOL,
    purpose: LocationPurpose.PICK,
  });

  const laterLocation = new Location({
    locationCode: "010350101",
    temperatureZone: TemperatureZone.KOL,
    purpose: LocationPurpose.PICK,
  });

  assert.equal(earlierLocation.comesBefore(laterLocation), true);
  assert.equal(laterLocation.comesBefore(earlierLocation), false);
});

test("derives the temperature zone from the location code", () => {
  const dryLocation = new Location({
    locationCode: "010250201",
    purpose: LocationPurpose.PICK,
  });

  const chilledLocation = new Location({
    locationCode: "110250201",
    purpose: LocationPurpose.PICK,
  });

  assert.equal(dryLocation.temperatureZone, TemperatureZone.KOL);
  assert.equal(chilledLocation.temperatureZone, TemperatureZone.KYLD);
});

test("identifies pick locations", () => {
  const location = new Location({
    locationCode: "010010101",
    purpose: LocationPurpose.PICK,
  });

  assert.equal(location.isPickLocation, true);
});

test("identifies buffer locations", () => {
  const location = new Location({
    locationCode: "010010301",
    purpose: LocationPurpose.BUFFER,
  });

  assert.equal(location.isPickLocation, false);
});