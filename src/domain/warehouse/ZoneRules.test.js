import test from "node:test";
import assert from "node:assert/strict";

import { TemperatureZone } from "../shared/TemperatureZone.js";
import { PickZoneType } from "../shared/PickZoneType.js";

import {
  getTemperatureZoneFromZoneCode,
  getPickZoneTypeFromZoneCode,
} from "./zone/ZoneRules.js";

test("maps zones 01 through 09 to dry storage", () => {
  assert.equal(
    getTemperatureZoneFromZoneCode("01"),
    TemperatureZone.KOL,
  );

  assert.equal(
    getPickZoneTypeFromZoneCode("01"),
    PickZoneType.KOLONIAL,
  );
});

test("maps zones 11 through 14 to chilled storage", () => {
  assert.equal(
    getTemperatureZoneFromZoneCode("11"),
    TemperatureZone.KYLD,
  );

  assert.equal(
    getPickZoneTypeFromZoneCode("11"),
    PickZoneType.KYLT,
  );
});

test("maps vegetable zones to chilled temperature and vegetable pick zone", () => {
  assert.equal(
    getTemperatureZoneFromZoneCode("20"),
    TemperatureZone.KYLD,
  );

  assert.equal(
    getPickZoneTypeFromZoneCode("20"),
    PickZoneType.GRONSAKER,
  );
});

test("maps zones 30 through 39 to frozen storage", () => {
  assert.equal(
    getTemperatureZoneFromZoneCode("30"),
    TemperatureZone.FRYST,
  );

  assert.equal(
    getPickZoneTypeFromZoneCode("30"),
    PickZoneType.FRYS,
  );
});

test("rejects an unconfigured zone", () => {
  assert.throws(
    () =>
      getTemperatureZoneFromZoneCode("10"),
    /no zone profile configured/i,
  );
});