export function buildRelocationViewModel(analysis) {
  const movementThreshold =
    analysis.simulation?.movementThreshold ?? 0.20;
  const recommendations = analysis.recommendations
    .filter((recommendation) => recommendation.recommendedArea !== null)
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
        pickZone: currentLocation.pickZoneType,
        currentLocation: currentLocation.locationCode,
        currentZone: currentLocation.zone,
        currentSection: currentPhysicalPosition?.zoneSection ?? "UNKNOWN",
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
        averageQuantityPerPick: article.averageQuantityPerPick,
        unitWeightKg: article.weightKg,
        frequencyScore: evaluation.frequencyScore,
        handlingScore: evaluation.handlingScore,
        priorityScore: evaluation.priorityScore,
        status: "NEW",
        classification: analysis.articles?.classification?.byArticle.get(article.articleNumber) ?? null,
      };
    });

  return recommendations
    .filter((recommendation) => (
      Math.abs(recommendation.placementGap) >= movementThreshold
    ))
    .toSorted((a, b) => (
      Math.abs(b.placementGap) - Math.abs(a.placementGap)
    ));
}
