import assert from "node:assert/strict";
import test from "node:test";

import { TemperatureZone } from "../shared/TemperatureZone.js";
import { getTemperatureZoneFromZoneCode } from "./zone/ZoneRules.js";

test("maps zones 01 through 09 to KOL", () => {
  assert.equal(
    getTemperatureZoneFromZoneCode("01"),
    TemperatureZone.KOL,
  );

  assert.equal(
    getTemperatureZoneFromZoneCode("09"),
    TemperatureZone.KOL,
  );
});

test("maps zones 11 through 13 to KYLD", () => {
  assert.equal(
    getTemperatureZoneFromZoneCode("11"),
    TemperatureZone.KYLD,
  );

  assert.equal(
    getTemperatureZoneFromZoneCode("13"),
    TemperatureZone.KYLD,
  );
});

test("rejects an unconfigured zone", () => {
  assert.throws(
    () => getTemperatureZoneFromZoneCode("10"),
    /no temperature zone configured/i,
  );
});