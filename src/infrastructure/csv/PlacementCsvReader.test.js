import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { PlacementCsvFormat, readPlacementCsvFile } from "./PlacementCsvReader.js";

const fixture = (name) => fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url));

test("reads the converted placement export", async () => {
  const result = await readPlacementCsvFile(fixture("article-placement.csv"));
  assert.equal(result.diagnostics.format, PlacementCsvFormat.CONVERTED);
  assert.equal(result.diagnostics.headerLine, 2);
  assert.equal(result.rows[1].Varunummer, "50343");
  assert.equal(result.rows[1].Plats, "010010101");
});

test("detects and normalizes the direct WMS placement export", async () => {
  const result = await readPlacementCsvFile(fixture("wms-item-placing-loc.csv"));
  assert.equal(result.diagnostics.format, PlacementCsvFormat.WMS_ITEM_PLACING_LOC);
  assert.equal(result.diagnostics.headerLine, 4);
  assert.equal(result.diagnostics.rawRows, 2);
  assert.equal(result.diagnostics.validRows, 1);
  assert.equal(result.diagnostics.ignoredRows, 1);
  assert.deepEqual(result.rows[0], {
    Zon: "01",
    Plats: "010010101",
    RepKasseID: "",
    Placering: "",
    Varunummer: "50343",
    Beskrivning: "Loka Naturell 33 Glas",
    Inköpsorder: "IN121387645",
    Lager: "29,000",
    Status: "Aktiv",
    "Mottagande datum": "12-07-2026 11:50:27",
  });
});
