import assert from "node:assert/strict";
import test from "node:test";

import { Article } from "./article/Article.js";
import { TemperatureZone } from "../shared/TemperatureZone.js";

test("creates a valid article", () => {
  const article = new Article({
    articleNumber: "10054",
    name: "Kaffe 500 g",
    weightKg: 0.5,
    temperatureZone: TemperatureZone.KOL,
  });

  assert.equal(article.articleNumber, "10054");
  assert.equal(article.name, "Kaffe 500 g");
  assert.equal(article.weightKg, 0.5);
  assert.equal(article.temperatureZone, TemperatureZone.KOL);
});

test("rejects a negative weight", () => {
  assert.throws(
    () =>
      new Article({
        articleNumber: "10054",
        name: "Kaffe 500 g",
        weightKg: -1,
        temperatureZone: TemperatureZone.KOL,
      }),
    /weight must be a non-negative number/i,
  );
});

test("rejects an invalid temperature zone", () => {
  assert.throws(
    () =>
      new Article({
        articleNumber: "10054",
        name: "Kaffe 500 g",
        weightKg: 0.5,
        temperatureZone: "HOT",
      }),
    /invalid temperature zone/i,
  );
});