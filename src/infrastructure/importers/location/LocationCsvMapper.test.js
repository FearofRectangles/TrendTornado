import assert from "node:assert/strict";
import test from "node:test";

import { mapLocationCsvRow } from "./LocationCsvMapper.js";
import { LocationPurpose } from "../../../domain/shared/LocationPurpose.js";

test("maps a pick location", () => {
  const row = {
    Lokation: "010010101",
    Lager_DelOmråde: "ÖVRIGT_Plock",
  };

  const location = mapLocationCsvRow(row);

  assert.equal(location.locationCode, "010010101");
  assert.equal(location.purpose, LocationPurpose.PICK);
  assert.equal(location.isPickLocation, true);
});

test("maps a buffer location", () => {
  const row = {
    Lokation: "010010301",
    Lager_DelOmråde: "ÖVRIGT_Buffer",
  };

  const location = mapLocationCsvRow(row);

  assert.equal(location.purpose, LocationPurpose.BUFFER);
  assert.equal(location.isPickLocation, false);
});

test("maps an unknown location type to OTHER", () => {
  const row = {
    Lokation: "010010401",
    Lager_DelOmråde: "ÖVRIGT_Annat",
  };

  const location = mapLocationCsvRow(row);

  assert.equal(location.purpose, LocationPurpose.OTHER);
});
test("maps a real warehouse export row", () => {
  const row = {
    Lagersted: "01",
    Zone: "01",
    Lokation: "010020101",
    LokationsType: "Dynamisk",
    Lager_Område: "ÖVRIGT",
    Lager_DelOmråde: "ÖVRIGT_Plock",
    Status: "1",
  };

  const location = mapLocationCsvRow(row);

  assert.equal(location.zone, "01");
  assert.equal(location.bay, "002");
  assert.equal(location.shelf, "01");
  assert.equal(location.position, "01");
  assert.equal(location.purpose, LocationPurpose.PICK);
});