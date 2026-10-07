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
  const observedPlacementsByArticle = new Map();

  for (const movement of movementRecords) {
    const articleNumber = String(movement?.articleNumber ?? "");
    const location = pickLocationsByCode.get(String(movement?.sourceLocation ?? ""));
    const observedAt = movement?.occurredAt;
    if (!articleNumber || !location || !(observedAt instanceof Date) || Number.isNaN(observedAt.getTime())) continue;

    const existing = latestObservedPlacementByArticle.get(articleNumber);
    if (!existing || observedAt > existing.observedAt) {
      latestObservedPlacementByArticle.set(articleNumber, { location, observedAt });
    }

    if (!observedPlacementsByArticle.has(articleNumber)) {
      observedPlacementsByArticle.set(articleNumber, []);
    }

    observedPlacementsByArticle.get(articleNumber).push({ location, observedAt });
  }

  const resolveSimulationLocation = (articleNumber, snapshotLocations) => {
    if (snapshotLocations.length === 1) {
      return {
        location: snapshotLocations[0],
        strategy: "SINGLE_SNAPSHOT",
        confidence: "HIGH",
        observationCount: 0,
        share: 1,
      };
    }

    if (snapshotLocations.length === 0) return null;

    const snapshotCodes = new Set(snapshotLocations.map((location) => String(location.locationCode)));
    const observations = observedPlacementsByArticle.get(articleNumber) ?? [];
    const latestTimestamp = observations.reduce(
      (latest, observation) => Math.max(latest, observation.observedAt.getTime()),
      -Infinity,
    );
    const recentLimit = latestTimestamp - (28 * 24 * 60 * 60 * 1000);
    const recent = observations.filter((observation) => (
      observation.observedAt.getTime() >= recentLimit &&
      snapshotCodes.has(String(observation.location.locationCode))
    ));

    if (recent.length === 0) return null;

    const byLocation = new Map();
    for (const observation of recent) {
      const code = String(observation.location.locationCode);
      const current = byLocation.get(code) ?? { count: 0, latest: -Infinity, location: observation.location };
      current.count += 1;
      current.latest = Math.max(current.latest, observation.observedAt.getTime());
      byLocation.set(code, current);
    }

    const [dominant] = [...byLocation.values()].sort((a, b) => (
      b.count - a.count || b.latest - a.latest
    ));
    const share = dominant.count / recent.length;

    return {
      location: dominant.location,
      strategy: "RECENT_WMS_DOMINANT",
      confidence: share >= 0.6 ? "MEDIUM" : "LOW",
      observationCount: recent.length,
      share,
    };
  };

  return articleStatistics.map((statistics) => {
    const articleNumber = String(statistics.articleNumber);
    const snapshotLocations = placementsByArticle.get(articleNumber) ?? [];
    const observedPlacement = latestObservedPlacementByArticle.get(articleNumber) ?? null;
    const simulationPlacement = resolveSimulationLocation(articleNumber, snapshotLocations);

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
        simulationPickLocation: simulationPlacement?.location ?? null,
        simulationPlacementEvidence: simulationPlacement,
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
        simulationPickLocation: observedPlacement.location,
        simulationPlacementEvidence: {
          location: observedPlacement.location,
          strategy: "LATEST_WMS_FALLBACK",
          confidence: "MEDIUM",
          observationCount: (observedPlacementsByArticle.get(articleNumber) ?? []).length,
          share: 1,
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
      simulationPickLocation: null,
      simulationPlacementEvidence: null,
    };
  });
}
