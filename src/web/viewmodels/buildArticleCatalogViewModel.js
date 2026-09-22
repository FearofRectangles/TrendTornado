export function buildArticleCatalogViewModel(analysis, masterArticles = []) {
  const movementThreshold = analysis.simulation?.movementThreshold ?? 0.20;
  const observedWeekCount = analysis.articles.classification?.observedWeekCount ?? 0;
  const evaluationByArticle = new Map(
    analysis.evaluations.all.map((evaluation) => [evaluation.articleNumber, evaluation]),
  );
  const recommendationByArticle = new Map(
    analysis.recommendations.map((recommendation) => [recommendation.article.articleNumber, recommendation]),
  );
  const physicalByLocation = new Map(
    analysis.warehouse.physicalZoneSequence.map((entry) => [entry.location.locationCode, entry]),
  );
  const analyzedByArticle = new Map(
    analysis.articles.positioned.map((article) => [article.articleNumber, article]),
  );
  const placementsByArticle = new Map();
  for (const placement of analysis.placements.pickPlacements) {
    const articleNumber = placement.article.articleNumber;
    if (!placementsByArticle.has(articleNumber)) placementsByArticle.set(articleNumber, []);
    placementsByArticle.get(articleNumber).push(placement.location);
  }
  const sequenceByLocation = new Map(
    analysis.warehouse.pickSequence.map((entry) => [entry.location.locationCode, entry]),
  );
  const sourceArticles = masterArticles.length > 0
    ? masterArticles
    : analysis.articles.positioned;

  return sourceArticles
    .map((masterArticle) => {
      const analyzed = analyzedByArticle.get(masterArticle.articleNumber) ?? null;
      const evaluation = evaluationByArticle.get(masterArticle.articleNumber) ?? null;
      const recommendation = recommendationByArticle.get(masterArticle.articleNumber) ?? null;
      const fallbackLocations = placementsByArticle.get(masterArticle.articleNumber) ?? [];
      const positioned = analyzed?.positionedPickLocations?.[0] ?? (
        fallbackLocations[0]
          ? {
              location: fallbackLocations[0],
              relativePickPosition: sequenceByLocation.get(fallbackLocations[0].locationCode)?.relativePickPosition ?? null,
            }
          : null
      );
      const location = positioned?.location ?? null;
      const physical = location
        ? physicalByLocation.get(location.locationCode) ?? null
        : null;
      const shelfHeight = location
        ? analysis.warehouse.shelfHeights?.get(location.locationCode) ?? null
        : null;

      return {
        articleNumber: masterArticle.articleNumber,
        name: masterArticle.name ?? "Okänt artikelnamn",
        weightKg: masterArticle.weightKg,
        temperatureZone: masterArticle.temperatureZone,
        category: masterArticle.category,
        baseUnit: masterArticle.baseUnit ?? null,
        articleHeightCm: masterArticle.heightCm ?? null,
        articleWidthCm: masterArticle.widthCm ?? null,
        articleDepthCm: masterArticle.depthCm ?? null,
        pickFrequency: analyzed?.pickFrequency ?? 0,
        pickedQuantity: analyzed?.pickedQuantity ?? 0,
        pickedQuantityPerWeek: observedWeekCount > 0
          ? (analyzed?.pickedQuantity ?? 0) / observedWeekCount
          : 0,
        observedWeekCount,
        averageQuantityPerPick: analyzed?.averageQuantityPerPick ?? 0,
        pickZone: location?.pickZoneType ?? null,
        currentLocation: location?.locationCode ?? null,
        currentZone: location?.zone ?? null,
        currentSection: physical?.zoneSection ?? null,
        currentPosition: evaluation?.currentPosition ?? positioned?.relativePickPosition ?? null,
        currentFloorHeightCm: shelfHeight?.floorHeightCm ?? null,
        currentTopHeightCm: shelfHeight?.topHeightCm ?? null,
        locationHeightCm: location?.heightCm ?? null,
        locationWidthCm: location?.widthCm ?? null,
        locationDepthCm: location?.depthCm ?? null,
        locationVolumeM3: shelfHeight?.volumeM3 ?? null,
        priorityScore: evaluation?.priorityScore ?? null,
        desiredPosition: evaluation?.desiredPosition ?? null,
        placementGap: evaluation?.placementGap ?? null,
        averageHandledWeightPerPick: evaluation?.averageHandledWeightPerPick ?? null,
        direction: evaluation
          ? evaluation.placementGap >= 0 ? "EARLIER" : "LATER"
          : null,
        isRelocationCandidate: evaluation
          ? Math.abs(evaluation.placementGap) >= movementThreshold
          : false,
        recommendedZone: recommendation?.recommendedArea?.zone ?? null,
        recommendedSection: recommendation?.recommendedArea?.section ?? null,
        ergonomicRecommendation: recommendation?.ergonomicRecommendation?.recommendation ?? null,
        ergonomicReason: recommendation?.ergonomicRecommendation?.reason ?? null,
        hasSinglePickLocation: (analyzed?.positionedPickLocations?.length ?? fallbackLocations.length) === 1,
        classification: analysis.articles.classification?.byArticle.get(masterArticle.articleNumber) ?? null,
      };
    })
    .toSorted((a, b) => (
      b.pickFrequency - a.pickFrequency ||
      a.articleNumber.localeCompare(b.articleNumber, "sv", { numeric: true })
    ));
}
