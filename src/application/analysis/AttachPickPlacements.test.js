import test from "node:test";
import assert from "node:assert/strict";

import { attachPickPlacements } from "./AttachPickPlacements.js";

test("attaches pick locations to article statistics", () => {
  const article = {
    articleNumber: "43454",
  };

  const location = {
    locationCode: "110010101",
  };

  const statistics = [
    {
      articleNumber: "43454",
      name: "Potatis Skalad Säck",
      weightKg: 7,
      pickFrequency: 177,
      pickedQuantity: 1197,
    },
  ];

  const placements = [
    {
      article,
      location,
    },
  ];

  const result = attachPickPlacements(
    statistics,
    placements,
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].pickLocations.length, 1);
  assert.equal(
    result[0].pickLocations[0].locationCode,
    "110010101",
  );
});

test("returns an empty location list when article has no pick placement", () => {
  const statistics = [
    {
      articleNumber: "43454",
      name: "Potatis Skalad Säck",
      weightKg: 7,
      pickFrequency: 177,
      pickedQuantity: 1197,
    },
  ];

  const result = attachPickPlacements(
    statistics,
    [],
  );

  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0].pickLocations,
    [],
  );
});