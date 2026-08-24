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
test("maps storage type Frys to FRYST", () => {
  const row = {
    Nr: "99999",
    Beskrivning: "Fryst testartikel",
    Basenhet: "KRT",
    Nettovikt: "1.5",
    Förvaringstyp: "Frys",
  };

  const article = mapArticleCsvRow(row);

  assert.equal(
    article.temperatureZone,
    TemperatureZone.FRYST,
  );
});

test("maps weight using comma as decimal separator", () => {
  const row = {
    Nr: "12345",
    Beskrivning: "Testartikel",
    Basenhet: "ST",
    Nettovikt: "2,6",
    Förvaringstyp: "Kolonial",
  };

  const article = mapArticleCsvRow(row);

  assert.equal(article.weightKg, 2.6);
});

test("rejects invalid article weight with article number", () => {
  const row = {
    Nr: "12345",
    Beskrivning: "Testartikel",
    Basenhet: "ST",
    Nettovikt: "banana",
    Förvaringstyp: "Kolonial",
  };

  assert.throws(
    () => mapArticleCsvRow(row),
    /invalid weight for article 12345/i,
  );
});