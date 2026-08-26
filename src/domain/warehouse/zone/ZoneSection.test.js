import test from "node:test";
import assert from "node:assert/strict";

import {
  ZoneSection,
  getZoneSection,
} from "./ZoneSection.js";

test("maps early positions to BEGINNING", () => {
  assert.equal(
    getZoneSection(0),
    ZoneSection.BEGINNING,
  );

  assert.equal(
    getZoneSection(0.2),
    ZoneSection.BEGINNING,
  );
});

test("maps middle positions to MIDDLE", () => {
  assert.equal(
    getZoneSection(1 / 3),
    ZoneSection.MIDDLE,
  );

  assert.equal(
    getZoneSection(0.5),
    ZoneSection.MIDDLE,
  );
});

test("maps late positions to END", () => {
  assert.equal(
    getZoneSection(2 / 3),
    ZoneSection.END,
  );

  assert.equal(
    getZoneSection(0.9),
    ZoneSection.END,
  );

  assert.equal(
    getZoneSection(1),
    ZoneSection.END,
  );
});

test("rejects positions below zero", () => {
  assert.throws(
    () => getZoneSection(-0.01),
    /between 0 and 1/i,
  );
});

test("rejects positions above one", () => {
  assert.throws(
    () => getZoneSection(1.01),
    /between 0 and 1/i,
  );
});

test("rejects non-numeric positions", () => {
  assert.throws(
    () => getZoneSection(null),
    /between 0 and 1/i,
  );
});