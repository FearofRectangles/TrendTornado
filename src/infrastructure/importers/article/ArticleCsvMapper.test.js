import assert from "node:assert/strict";
import test from "node:test";

import { mapArticleCsvRow } from "./ArticleCsvMapper.js";
import { TemperatureZone } from "../../../domain/shared/TemperatureZone.js";

test("maps article CSV row to Article", () => {
  const row = {
    Nr: "33300",
    Beskrivning: "3-Mixbönor EKO 2,6kg",
    Basenhet: "BURK",
    Nettovikt: "2.6",
    Förvaringstyp: "Kolonial",
  };

  const article = mapArticleCsvRow(row);

  assert.equal(article.articleNumber, "33300");
  assert.equal(article.name, "3-Mixbönor EKO 2,6kg");
  assert.equal(article.weightKg, 2.6);
  assert.equal(article.temperatureZone, TemperatureZone.KOL);
});