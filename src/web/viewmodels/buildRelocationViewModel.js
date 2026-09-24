import { RelocationUtilityEngine } from "../../application/optimization/RelocationUtilityEngine.js";

export function buildRelocationViewModel(analysis, settings = {}) {
  const movementThreshold =
    analysis.simulation?.movementThreshold ?? 0.20;
  const observedWeekCount = analysis.articles?.classification?.observedWeekCount ?? 0;
  const hiddenRelocations = new Set((settings.articleRules ?? []).filter((rule) => rule.hideRelocation).map((rule) => rule.articleNumber));
  const recommendations = analysis.recommendations
    .filter((recommendation) => recommendation.recommendedArea !== null)
    .filter((recommendation) => !hiddenRelocations.has(recommendation.article.articleNumber))
    .map((recommendation) => {
      const {
        evaluation,
        article,
        currentLocation,
        currentPhysicalPosition,
        recommendedArea,
        ergonomicRecommendation,
      } = recommendation;

      return {
        articleNumber: article.articleNumber,
        name: article.name ?? "UNKNOWN",
        pickZone: currentLocation.pickZoneType ?? "UNKNOWN",
        currentLocation: currentLocation.locationCode,
        currentZone: currentLocation.zone,
        currentSection: currentPhysicalPosition?.zoneSection ?? "UNKNOWN",
        currentFloorHeightCm: recommendation.currentShelfHeight?.floorHeightCm ?? null,
        currentPosition: evaluation.currentPosition,
        recommendedZone: recommendedArea.zone,
        recommendedSection: recommendedArea.section,
        desiredPosition: evaluation.desiredPosition,
        placementGap: evaluation.placementGap,
        direction: evaluation.placementGap >= 0 ? "EARLIER" : "LATER",
        ergonomicRecommendation: ergonomicRecommendation.recommendation,
        ergonomicReason: ergonomicRecommendation.reason,
        averageHandledWeightPerPick: evaluation.averageHandledWeightPerPick,
        pickFrequency: article.pickFrequency,
        pickedQuantity: article.pickedQuantity,
        pickedQuantityPerWeek: observedWeekCount > 0
          ? article.pickedQuantity / observedWeekCount
          : 0,
        observedWeekCount,
        averageQuantityPerPick: article.averageQuantityPerPick,
        unitWeightKg: article.weightKg,
        frequencyScore: evaluation.frequencyScore,
        handlingScore: evaluation.handlingScore,
        priorityScore: evaluation.priorityScore,
        classification: analysis.articles?.classification?.byArticle.get(article.articleNumber) ?? null,
        placementOptions: recommendation.placementOptions ?? null,
      };
    });

  return RelocationUtilityEngine.score(recommendations
    .filter((recommendation) => (
      Math.abs(recommendation.placementGap) >= movementThreshold
    )));
}
