function buildBins(values, definitions) {
  return definitions.map((definition) => ({
    label: definition.label,
    count: values.filter((value) => (
      value >= definition.minimum && value < definition.maximum
    )).length,
  }));
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const ordered = values.toSorted((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1));
  return ordered[index];
}

export function buildAnalysisViewModel(analysis, affinityModel = null, pickAreaPresentation = {}) {
  const sourceCoverage = analysis.dataCoverage ?? {};
  const simulationDiagnostics = analysis.simulation.diagnostics ?? {};
  const totalSimulationRecords = simulationDiagnostics.totalRecords ?? 0;
  const includedSimulationRecords = simulationDiagnostics.includedRecords ?? 0;
  const totalSimulationDocuments = simulationDiagnostics.totalDocuments ?? 0;
  const completeSimulationDocuments = simulationDiagnostics.fullyCoveredDocuments ?? 0;
  const includedWeightRecords = simulationDiagnostics.includedWeightRecords ?? 0;
  const derivedFlowCoverage = totalSimulationRecords > 0
    ? includedSimulationRecords / totalSimulationRecords
    : 0;
  const derivedDocumentCoverage = totalSimulationDocuments > 0
    ? completeSimulationDocuments / totalSimulationDocuments
    : 0;
  const derivedWeightCoverage = includedSimulationRecords > 0
    ? includedWeightRecords / includedSimulationRecords
    : 0;
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
  const orderSpans = (baseline?.orderSimulations ?? [])
    .filter((order) => order.pickCount >= 2)
    .map((order) => order.pickSpan)
    .filter(Number.isFinite);
  const spanBins = buildBins(orderSpans, [
    { label: "0–20 %", minimum: 0, maximum: 0.2 },
    { label: "20–40 %", minimum: 0.2, maximum: 0.4 },
    { label: "40–60 %", minimum: 0.4, maximum: 0.6 },
    { label: "60–80 %", minimum: 0.6, maximum: 0.8 },
    { label: "80–100 %", minimum: 0.8, maximum: Number.POSITIVE_INFINITY },
  ]);
  const totalEvaluationActivity = evaluations.reduce((sum, item) => (
    sum + (articlesByNumber.get(item.articleNumber)?.pickFrequency ?? 0)
  ), 0);
  const candidateEvaluations = evaluations.filter((item) => (
    Math.abs(item.placementGap) >= analysis.simulation.movementThreshold
  ));
  const candidateActivity = candidateEvaluations.reduce((sum, item) => (
    sum + (articlesByNumber.get(item.articleNumber)?.pickFrequency ?? 0)
  ), 0);
  const weightedGapNumerator = evaluations.reduce((sum, item) => {
    const activity = articlesByNumber.get(item.articleNumber)?.pickFrequency ?? 0;
    return sum + Math.abs(item.placementGap) * activity;
  }, 0);
  const ergonomicSegments = Array.from({ length: 10 }, (_, index) => ({
    index: index + 1,
    label: `${index * 10}–${(index + 1) * 10} %`,
    handledWeight: 0,
    stops: 0,
  }));
  const ergonomicSegmentsByZone = new Map();
  evaluations.forEach((evaluation) => {
    const article = articlesByNumber.get(evaluation.articleNumber);
    const segmentIndex = Math.min(9, Math.max(0, Math.floor(evaluation.currentPosition * 10)));
    const stops = article?.pickFrequency ?? 0;
    const handledWeight = Number.isFinite(article?.weightKg)
      ? (article.pickedQuantity ?? 0) * article.weightKg
      : 0;
    ergonomicSegments[segmentIndex].stops += stops;
    ergonomicSegments[segmentIndex].handledWeight += handledWeight;
    const pickZone = article?.positionedPickLocations?.[0]?.location?.pickZoneType;
    if (!pickZone) return;
    if (!ergonomicSegmentsByZone.has(pickZone)) {
      ergonomicSegmentsByZone.set(pickZone, Array.from({ length: 10 }, (_, index) => ({
        index: index + 1,
        label: `${index * 10}–${(index + 1) * 10} %`,
        handledWeight: 0,
        stops: 0,
      })));
    }
    ergonomicSegmentsByZone.get(pickZone)[segmentIndex].stops += stops;
    ergonomicSegmentsByZone.get(pickZone)[segmentIndex].handledWeight += handledWeight;
  });
  const totalHandledWeight = ergonomicSegments.reduce((sum, segment) => sum + segment.handledWeight, 0);
  const lateHandledWeight = ergonomicSegments.slice(7).reduce((sum, segment) => sum + segment.handledWeight, 0);
  const flowZones = [...ergonomicSegmentsByZone].map(([name, segments]) => {
    const zoneWeight = segments.reduce((sum, segment) => sum + segment.handledWeight, 0);
    const lateWeight = segments.slice(7).reduce((sum, segment) => sum + segment.handledWeight, 0);
    return {
      name,
      color: pickAreaPresentation[name]?.color ?? "#16824a",
      order: pickAreaPresentation[name]?.order ?? Number.MAX_SAFE_INTEGER,
      segments,
      totalHandledWeight: zoneWeight,
      lateHandledWeightShare: zoneWeight > 0 ? lateWeight / zoneWeight : 0,
      maximumSegmentWeight: Math.max(1, ...segments.map((segment) => segment.handledWeight)),
    };
  }).toSorted((left, right) => left.order - right.order || left.name.localeCompare(right.name, "sv"));
  const articlesWithDimensions = analysis.articles.positioned.filter((article) => (
    Number.isFinite(article.heightCm) && Number.isFinite(article.widthCm) && Number.isFinite(article.depthCm)
  )).length;
  const operationalPortfolio = analysis.relocationImpact?.portfolio ?? {};
  const packageSummary = ["SMALL", "STANDARD", "LARGE"].map((size) => {
    const packages = (analysis.relocationPackages?.packages ?? []).filter((item) => item.size === size);
    return {
      size,
      label: size === "SMALL" ? "Små paket" : size === "STANDARD" ? "Standardpaket" : "Stora paket",
      packages: packages.length,
      moves: packages.reduce((sum, item) => sum + item.steps.length, 0),
      objectiveGain: packages.reduce((sum, item) => sum + item.objectiveGain, 0),
      spanImprovement: packages.reduce((sum, item) => sum + item.spanImprovement, 0),
      weightOrderImprovement: packages.reduce((sum, item) => sum + item.weightOrderImprovement, 0),
    };
  }).filter((item) => item.packages > 0);
  const desiredPositionByArticle = new Map(evaluations.map((item) => [
    String(item.articleNumber),
    Math.abs(item.placementGap) >= analysis.simulation.movementThreshold
      ? item.desiredPosition
      : item.currentPosition,
  ]));
  let affinityWeight = 0;
  let currentAffinityDistance = 0;
  let projectedAffinityDistance = 0;
  for (const cluster of affinityModel?.clusters ?? []) {
    const weight = Math.max(1, cluster.occurrenceCount ?? 0) * Math.max(0.01, cluster.averageAffinity ?? 0);
    const currentPositions = cluster.articles.map((article) => article.currentPosition).filter(Number.isFinite);
    if (currentPositions.length < 2) continue;
    const currentSpread = Math.max(...currentPositions) - Math.min(...currentPositions);
    const metersPerPosition = currentSpread > 0 ? cluster.estimatedSpreadMeters / currentSpread : 0;
    const projectedPositions = cluster.articles.map((article) => (
      desiredPositionByArticle.get(String(article.articleNumber)) ?? article.currentPosition
    )).filter(Number.isFinite);
    const projectedSpread = Math.max(...projectedPositions) - Math.min(...projectedPositions);
    affinityWeight += weight;
    currentAffinityDistance += cluster.estimatedSpreadMeters * weight;
    projectedAffinityDistance += projectedSpread * metersPerPosition * weight;
  }

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
      flowSegments: ergonomicSegments,
      flowZones,
      lateHandledWeightShare: totalHandledWeight > 0 ? lateHandledWeight / totalHandledWeight : 0,
      totalHandledWeight,
    },
    placement: {
      activityWeightedGap: totalEvaluationActivity > 0 ? weightedGapNumerator / totalEvaluationActivity : 0,
      candidateActivityShare: totalEvaluationActivity > 0 ? candidateActivity / totalEvaluationActivity : 0,
      candidates: candidateEvaluations.length,
      evaluated: evaluations.length,
    },
    orderSpan: {
      bins: spanBins,
      orders: orderSpans.length,
      median: percentile(orderSpans, 0.5),
      p75: percentile(orderSpans, 0.75),
      p90: percentile(orderSpans, 0.9),
      veryLargeShare: orderSpans.length > 0
        ? orderSpans.filter((span) => span >= 0.8).length / orderSpans.length
        : 0,
    },
    capacity: {
      articlesWithDimensions,
      analyzedArticles: analysis.articles.positioned.length,
      dimensionCoverage: analysis.articles.positioned.length > 0
        ? articlesWithDimensions / analysis.articles.positioned.length
        : 0,
      operationalCandidates: operationalPortfolio.operationalCandidateCount ?? 0,
      theoreticalCandidates: operationalPortfolio.theoreticalCandidateCount ?? 0,
      missingDimensions: operationalPortfolio.missingDimensionCandidateCount ?? 0,
      noFeasibleLocation: operationalPortfolio.noFeasibleLocationCandidateCount ?? 0,
      packageSummary,
    },
    affinity: {
      clusters: affinityModel?.summary?.clusters ?? 0,
      currentWeightedDistanceMeters: affinityWeight > 0 ? currentAffinityDistance / affinityWeight : 0,
      projectedWeightedDistanceMeters: affinityWeight > 0 ? projectedAffinityDistance / affinityWeight : 0,
      improvement: currentAffinityDistance > 0
        ? (currentAffinityDistance - projectedAffinityDistance) / currentAffinityDistance
        : 0,
    },
    simulation: {
      baseline,
      optimized,
      comparison: analysis.simulation.comparison,
      diagnostics: analysis.simulation.diagnostics,
      coverage: analysis.simulation.coverage,
      coverageDetails: analysis.simulation.coverageDetails ?? {
        flow: analysis.simulation.coverage ?? 0,
        completeDocuments: 0,
        weight: 0,
        relocation: 0,
      },
      improvedWeightPairs: optimized.correctlyOrderedPairs - baseline.correctlyOrderedPairs,
      dataCoverage: {
        placement: sourceCoverage.placement ?? { snapshotCoverage: 0, resolvedCoverage: 0, snapshotArticles: 0, wmsObservedArticles: 0, unknownArticles: 0 },
        movementLocation: sourceCoverage.movementLocation ?? { coverage: 0, resolvedRecords: 0, records: 0 },
        weight: sourceCoverage.weight ?? { coverage: 0, validRecords: 0, records: 0 },
        flow: sourceCoverage.flow ?? {
          coverage: analysis.simulation.coverage ?? derivedFlowCoverage,
          includedRecords: includedSimulationRecords,
          records: totalSimulationRecords,
          completeDocumentCoverage: derivedDocumentCoverage,
          completeDocuments: completeSimulationDocuments,
          documents: totalSimulationDocuments,
        },
        simulatedWeight: sourceCoverage.simulatedWeight ?? {
          coverage: derivedWeightCoverage,
          validRecords: includedWeightRecords,
          records: includedSimulationRecords,
        },
        relocation: sourceCoverage.relocation ?? {
          coverage: 0,
          eligibleArticles: analysis.evaluations.all.length,
          analyzedArticles: analysis.articles.positioned.length,
        },
      },
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
