import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, validateSettings } from "./DefaultSettings.js";

test("accepts and normalizes the default model settings", () => {
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), {
    analysis: { movementThreshold: 0.2, frequencyWeight: 0.7, handlingWeight: 0.3 },
    ergonomics: { lowPreferredKg: 4, lowStronglyRecommendedKg: 8 },
    distance: { standardBayWidthMeters: 1 },
  });
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
