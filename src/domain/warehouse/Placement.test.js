import assert from "node:assert/strict";
import test from "node:test";

import { Article } from "./article/Article.js";
import { Location } from "./location/Location.js";
import { Placement } from "./placement/Placement.js";
import { TemperatureZone } from "../shared/TemperatureZone.js";
import { LocationPurpose } from "../shared/LocationPurpose.js";

test("creates a valid placement", () => {
  const article = new Article({
    articleNumber: "10054",
    name: "Kaffe 500 g",
    weightKg: 0.5,
    temperatureZone: TemperatureZone.KOL,
  });

  const location = new Location({
    locationCode: "010250201",
    purpose: LocationPurpose.PICK,
  });

  const placement = new Placement({
    article,
    location,
  });

  assert.equal(placement.article, article);
  assert.equal(placement.location, location);
});

test("rejects a placement with mismatching temperature zones", () => {
  const chilledArticle = new Article({
    articleNumber: "20010",
    name: "Mjölk 1 l",
    weightKg: 1,
    temperatureZone: TemperatureZone.KYLD,
  });

  const dryLocation = new Location({
    locationCode: "010250201",
    purpose: LocationPurpose.PICK,
  });

  assert.throws(
    () =>
      new Placement({
        article: chilledArticle,
        location: dryLocation,
      }),
    /temperature zones do not match/i,
  );
});

test("rejects an invalid article", () => {
  const location = new Location({
    locationCode: "010250201",
    purpose: LocationPurpose.PICK,
  });

  assert.throws(
    () =>
      new Placement({
        article: {},
        location,
      }),
    /valid article/i,
  );
});

test("rejects an invalid location", () => {
  const article = new Article({
    articleNumber: "10054",
    name: "Kaffe 500 g",
    weightKg: 0.5,
    temperatureZone: TemperatureZone.KOL,
  });

  assert.throws(
    () =>
      new Placement({
        article,
        location: {},
      }),
    /valid location/i,
  );
});