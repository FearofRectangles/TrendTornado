import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRelocationViewModel,
} from "./buildRelocationViewModel.js";

function recommendation(articleNumber, placementGap) {
  return {
    evaluation: {
      articleNumber,
      currentPosition: 0.7,
      desiredPosition: 0.2,
      placementGap,
      averageHandledWeightPerPick: 4,
      frequencyScore: 0.8,
      handlingScore: 0.5,
      priorityScore: 0.71,
    },
    article: {
      articleNumber,
      name: `Article ${articleNumber}`,
      pickFrequency: 20,
      pickedQuantity: 40,
      averageQuantityPerPick: 2,
      weightKg: 2,
    },
    currentLocation: {
      locationCode: "20-001",
      zone: "20",
      pickZoneType: "KOL",
    },
    currentPhysicalPosition: { zoneSection: "MIDDLE" },
    recommendedArea: { zone: "21", section: "BEGINNING" },
    ergonomicRecommendation: {
      recommendation: "LOW_PREFERRED",
      reason: "Test reason",
    },
  };
}

test("builds, filters and sorts the shared relocation view model", () => {
  const result = buildRelocationViewModel({
    articles: { classification: { observedWeekCount: 8, byArticle: new Map() } },
    recommendations: [
      recommendation("A", 0.19),
      recommendation("B", -0.45),
      recommendation("C", 0.25),
    ],
  });

  assert.deepEqual(result.map((item) => item.articleNumber), ["B", "C"]);
  assert.equal(result[0].direction, "LATER");
  assert.equal(result[1].direction, "EARLIER");
  assert.ok(result[0].utility.score > result[1].utility.score);
  assert.equal(result[0].pickFrequency, 20);
  assert.equal(result[0].pickedQuantityPerWeek, 5);
});
