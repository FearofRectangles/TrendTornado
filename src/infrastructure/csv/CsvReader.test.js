import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { readCsvFile } from "./CsvReader.js";

const fixturePath = fileURLToPath(
  new URL(
    "../../../test/fixtures/pick-history.csv",
    import.meta.url,
  ),
);

const placementFixturePath = fileURLToPath(
  new URL(
    "../../../test/fixtures/article-placement.csv",
    import.meta.url,
  ),
);
test("can skip lines before the CSV header", async () => {
  const rows = await readCsvFile(
    placementFixturePath,
    {
      fromLine: 2,
    },
  );

  assert.equal(rows.length, 2);

  assert.equal(
    rows[1].Plats,
    "010010101",
  );

  assert.equal(
    rows[1].Varunummer,
    "50343",
  );
});