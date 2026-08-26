import test from "node:test";
import assert from "node:assert/strict";

import {
  attachPickSequence,
} from "./AttachPickSequence.js";

test("attaches sequence data to article pick locations", () => {
  const location = {
    locationCode: "200180303",
  };

  const analyzedArticles = [
    {
      articleNumber: "43454",
      name: "Potatis Skalad Säck",
      pickLocations: [location],
    },
  ];

  const pickSequence = [
    {
      location,
      pickZoneType: "GRÖNSAKER",
      pickSequence: 135,
      totalPickLocations: 500,
      relativePickPosition: 0.2685,
    },
  ];

  const [result] = attachPickSequence(
    analyzedArticles,
    pickSequence,
  );

  assert.equal(
    result.positionedPickLocations.length,
    1,
  );

  assert.equal(
    result.positionedPickLocations[0].pickSequence,
    135,
  );

  assert.equal(
    result.positionedPickLocations[0].totalPickLocations,
    500,
  );

  assert.equal(
    result.positionedPickLocations[0].relativePickPosition,
    0.2685,
  );
});

test("handles missing sequence information", () => {
  const analyzedArticles = [
    {
      articleNumber: "43454",
      pickLocations: [
        {
          locationCode: "200180303",
        },
      ],
    },
  ];

  const [result] = attachPickSequence(
    analyzedArticles,
    [],
  );

  assert.equal(
    result.positionedPickLocations[0].pickSequence,
    null,
  );

  assert.equal(
    result.positionedPickLocations[0].relativePickPosition,
    null,
  );
});