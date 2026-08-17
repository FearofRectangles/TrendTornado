import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { readCsvFile } from "./CsvReader.js";

const fixturePath = fileURLToPath(
  new URL("../../../test/fixtures/pick-history.csv", import.meta.url),
);

test("reads a CSV file into rows", async () => {
  const rows = await readCsvFile(fixturePath);

  assert.equal(rows.length, 3);

  assert.equal(rows[0].Bokföringsdatum, "8/30/25");
  assert.equal(rows[0].Dokumentnr, "UT121519196");
  assert.equal(rows[0].Artikelnr, "126925");
  assert.equal(rows[0].Antal, "-1.");
});

test("handles quoted values containing commas", async () => {
  const rows = await readCsvFile(fixturePath);

  assert.equal(
    rows[0].Artikelbeskrivning,
    "Dressing Rhode Island 2,5kg",
  );
});