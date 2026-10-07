export function attachPickPlacements(
  articleStatistics,
  pickPlacements,
  {
    movementRecords = [],
    locations = [],
  } = {},
) {
  const placementsByArticle = new Map();

  for (const placement of pickPlacements) {
    const articleNumber = String(placement.article.articleNumber);

    if (!placementsByArticle.has(articleNumber)) {
      placementsByArticle.set(articleNumber, []);
    }

    placementsByArticle
      .get(articleNumber)
      .push(placement.location);
  }

  const pickLocationsByCode = new Map(
    locations
      .filter((location) => location?.isPickLocation === true || location?.purpose === "PICK")
      .map((location) => [String(location.locationCode), location]),
  );
  const latestObservedPlacementByArticle = new Map();

  for (const movement of movementRecords) {
    const articleNumber = String(movement?.articleNumber ?? "");
    const location = pickLocationsByCode.get(String(movement?.sourceLocation ?? ""));
    const observedAt = movement?.occurredAt;
    if (!articleNumber || !location || !(observedAt instanceof Date) || Number.isNaN(observedAt.getTime())) continue;

    const existing = latestObservedPlacementByArticle.get(articleNumber);
    if (!existing || observedAt > existing.observedAt) {
      latestObservedPlacementByArticle.set(articleNumber, { location, observedAt });
    }
  }

  return articleStatistics.map((statistics) => {
    const articleNumber = String(statistics.articleNumber);
    const snapshotLocations = placementsByArticle.get(articleNumber) ?? [];
    const observedPlacement = latestObservedPlacementByArticle.get(articleNumber) ?? null;

    if (snapshotLocations.length > 0) {
      return {
        ...statistics,
        pickLocations: snapshotLocations,
        placementEvidence: {
          source: "PLACEMENT_SNAPSHOT",
          confidence: "HIGH",
          observedAt: null,
          locationCode: snapshotLocations.length === 1 ? snapshotLocations[0].locationCode : null,
        },
      };
    }

    if (observedPlacement) {
      return {
        ...statistics,
        pickLocations: [observedPlacement.location],
        placementEvidence: {
          source: "WMS_HISTORY",
          confidence: "MEDIUM",
          observedAt: observedPlacement.observedAt,
          locationCode: observedPlacement.location.locationCode,
        },
      };
    }

    return {
      ...statistics,
      pickLocations: [],
      placementEvidence: {
        source: "NONE",
        confidence: "NONE",
        observedAt: null,
        locationCode: null,
      },
    };
  });
}
