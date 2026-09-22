function buildBins(values, definitions) {
  return definitions.map((definition) => ({
    label: definition.label,
    count: values.filter((value) => (
      value >= definition.minimum && value < definition.maximum
    )).length,
  }));
}

export function buildAnalysisViewModel(analysis) {
  const articlesByNumber = new Map(
    analysis.articles.positioned.map((article) => [article.articleNumber, article]),
  );
  const frequencyValues = analysis.articles.positioned
    .map((article) => article.pickFrequency)
    .filter((value) => Number.isFinite(value) && value > 0);
  const evaluations = analysis.evaluations.all;
  const handledWeights = evaluations
    .map((evaluation) => evaluation.averageHandledWeightPerPick)
    .filter(Number.isFinite);

  const frequencyBins = buildBins(frequencyValues, [
    { label: "1", minimum: 1, maximum: 2 },
    { label: "2–5", minimum: 2, maximum: 6 },
    { label: "6–10", minimum: 6, maximum: 11 },
    { label: "11–25", minimum: 11, maximum: 26 },
    { label: "26–50", minimum: 26, maximum: 51 },
    { label: "51–100", minimum: 51, maximum: 101 },
    { label: "101+", minimum: 101, maximum: Number.POSITIVE_INFINITY },
  ]);
  const weightBins = buildBins(handledWeights, [
    { label: "0–2 kg", minimum: 0, maximum: 2 },
    { label: "2–5 kg", minimum: 2, maximum: 5 },
    { label: "5–10 kg", minimum: 5, maximum: 10 },
    { label: "10–15 kg", minimum: 10, maximum: 15 },
    { label: "15+ kg", minimum: 15, maximum: Number.POSITIVE_INFINITY },
  ]);
  const scatterPoints = evaluations.map((evaluation) => {
    const article = articlesByNumber.get(evaluation.articleNumber);
    return {
      articleNumber: evaluation.articleNumber,
      name: article?.name ?? "Okänd artikel",
      pickZone: article?.positionedPickLocations?.[0]?.location?.pickZoneType ?? "OTHER",
      currentPosition: evaluation.currentPosition,
      priorityScore: evaluation.priorityScore,
      placementGap: evaluation.placementGap,
      candidate: Math.abs(evaluation.placementGap) >= analysis.simulation.movementThreshold,
    };
  });
  const baseline = analysis.simulation.baseline;
  const optimized = analysis.simulation.optimized;
  const classificationResult = analysis.articles.classification;
  const classified = [...(classificationResult?.byArticle?.values() ?? [])];
  const matrix = ["A", "B", "C"].flatMap((abcClass) => (
    ["X", "Y", "Z"].map((xyzClass) => {
      const members = classified.filter((item) => item.abcClass === abcClass && item.xyzClass === xyzClass);
      return {
        key: `${abcClass}${xyzClass}`,
        abcClass,
        xyzClass,
        count: members.length,
        activityShare: members.reduce((sum, item) => sum + item.abc.activityShare, 0),
      };
    })
  ));
  const evaluationByArticle = new Map(evaluations.map((item) => [item.articleNumber, item]));
  const axFarBack = classified.filter((item) => (
    item.classification === "AX" &&
    (evaluationByArticle.get(item.articleNumber)?.currentPosition ?? 0) >= 0.5
  )).length;
  const czEarly = classified.filter((item) => (
    item.classification === "CZ" &&
    (evaluationByArticle.get(item.articleNumber)?.currentPosition ?? 1) <= 0.25
  )).length;

  return {
    frequency: {
      bins: frequencyBins,
      articles: frequencyValues.length,
      singleStopArticles: frequencyValues.filter((value) => value === 1).length,
      maximum: Math.max(0, ...frequencyValues),
    },
    scatter: {
      points: scatterPoints,
      candidates: scatterPoints.filter((point) => point.candidate).length,
    },
    weight: {
      bins: weightBins,
      evaluatedArticles: handledWeights.length,
      lowPreferred: analysis.recommendations.filter((item) => (
        item.ergonomicRecommendation.recommendation === "LOW_PREFERRED"
      )).length,
      lowStronglyRecommended: analysis.recommendations.filter((item) => (
        item.ergonomicRecommendation.recommendation === "LOW_STRONGLY_RECOMMENDED"
      )).length,
      locationHeightAvailable: analysis.warehouse.pickSequence.some((entry) => (
        Number.isFinite(analysis.warehouse.shelfHeights?.get(entry.location.locationCode)?.floorHeightCm)
      )),
      heavyArticlesAboveLowZone: analysis.recommendations.filter((item) => (
        (item.ergonomicRecommendation.recommendation === "LOW_PREFERRED" ||
          item.ergonomicRecommendation.recommendation === "LOW_STRONGLY_RECOMMENDED") &&
        Number.isFinite(item.currentShelfHeight?.floorHeightCm) &&
        item.currentShelfHeight.floorHeightCm > 70
      )).length,
    },
    simulation: {
      baseline,
      optimized,
      comparison: analysis.simulation.comparison,
      diagnostics: analysis.simulation.diagnostics,
      coverage: analysis.simulation.coverage,
      improvedWeightPairs: optimized.correctlyOrderedPairs - baseline.correctlyOrderedPairs,
    },
    classification: {
      observedWeeks: classificationResult?.observedWeeks ?? [],
      observedWeekCount: classificationResult?.observedWeekCount ?? 0,
      quality: classificationResult?.quality ?? "INSUFFICIENT",
      classifiedArticles: classified.length,
      abc: ["A", "B", "C"].map((abcClass) => {
        const members = classified.filter((item) => item.abcClass === abcClass);
        return {
          class: abcClass,
          count: members.length,
          activityShare: members.reduce((sum, item) => sum + item.abc.activityShare, 0),
        };
      }),
      matrix,
      axFarBack,
      czEarly,
    },
  };
}
