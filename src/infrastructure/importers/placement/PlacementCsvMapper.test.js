import test from "node:test";
import assert from "node:assert/strict";

import {
  mapPlacementCsvRow,
} from "./PlacementCsvMapper.js";

test("maps a placement CSV row", () => {
  const row = {
    Zon: "",
    Plats: "010010101",
    RepKasseID: "",
    Varunummer: "50343",
    Beskrivning: "Loka Naturell 33 Glas",
    Inköpsorder: "IN121386887",
    Lager: "13",
    Status: "Aktiv",
    "Mottagande datum": "12-07-2026 11:50:27",
  };

  const result = mapPlacementCsvRow(row);

  assert.equal(result.articleNumber, "50343");
  assert.equal(result.locationCode, "010010101");
  assert.equal(result.status, "Aktiv");
  assert.equal(
    result.description,
    "Loka Naturell 33 Glas",
  );
});

test("ignores zone header rows", () => {
  const row = {
    Zon: "01",
    Plats: "",
    Varunummer: "",
    Beskrivning: "",
  };

  const result = mapPlacementCsvRow(row);

  assert.equal(result, null);
});

test("ignores rows without an article number", () => {
  const row = {
    Plats: "010010101",
    Varunummer: "",
  };

  assert.equal(
    mapPlacementCsvRow(row),
    null,
  );
});

test("ignores rows without a location code", () => {
  const row = {
    Plats: "",
    Varunummer: "50343",
  };

  assert.equal(
    mapPlacementCsvRow(row),
    null,
  );
});

test("ignores WMS system locations", () => {
  assert.equal(
    mapPlacementCsvRow({ Plats: "Sys-9001", Varunummer: "BOX10180277" }),
    null,
  );
});
