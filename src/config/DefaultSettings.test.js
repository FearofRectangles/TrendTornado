import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, validateSettings } from "./DefaultSettings.js";

test("accepts and normalizes the default model settings", () => {
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), {
    analysis: { movementThreshold: 0.2, frequencyWeight: 0.7, handlingWeight: 0.3 },
    ergonomics: { lowPreferredKg: 4, lowStronglyRecommendedKg: 8 },
    distance: { standardBayWidthMeters: 1, beamThicknessCm: 12 },
    classification: { abcAThreshold: 0.8, abcBThreshold: 0.95 },
    articleRules: DEFAULT_SETTINGS.articleRules.map((rule) => ({ ...rule })),
    warehouse: {
      pickAreas: DEFAULT_SETTINGS.warehouse.pickAreas.map((area) => ({ ...area })),
      zoneMappings: DEFAULT_SETTINGS.warehouse.zoneMappings.map((mapping) => ({ ...mapping })),
    },
  });
});

test("rejects duplicate article exceptions", () => {
  assert.throws(() => validateSettings({
    ...DEFAULT_SETTINGS,
    articleRules: [
      { articleNumber: "123", excludeFromAnalysis: true, hideRelocation: false },
      { articleNumber: "123", excludeFromAnalysis: false, hideRelocation: true },
    ],
  }), /unikt artikelnummer/);
});

test("rejects priority weights that do not total one hundred percent", () => {
  assert.throws(() => validateSettings({
    ...DEFAULT_SETTINGS,
    analysis: { ...DEFAULT_SETTINGS.analysis, frequencyWeight: 0.8 },
  }), /100 %/);
});

test("rejects an invalid standard bay width", () => {
  assert.throws(() => validateSettings({
    ...DEFAULT_SETTINGS,
    distance: { standardBayWidthMeters: 0 },
  }), /Standardfackets bredd/);
});
