function normalize(value, maximum) {
  if (!Number.isFinite(value) || maximum <= 0) return 0;
  return Math.log1p(Math.max(0, value)) / Math.log1p(maximum);
}

export function buildWarehouseStructureViewModel(analysis) {
  const evaluationByArticle = new Map(
    analysis.evaluations.all.map((evaluation) => [evaluation.articleNumber, evaluation]),
  );
  const statisticsByArticle = new Map(
    analysis.articles.positioned.map((article) => [article.articleNumber, article]),
  );
  const placementsByLocation = new Map();
  for (const placement of analysis.placements.pickPlacements) {
    const code = placement.location.locationCode;
    if (!placementsByLocation.has(code)) placementsByLocation.set(code, []);
    const evaluation = evaluationByArticle.get(placement.article.articleNumber) ?? null;
    const statistics = statisticsByArticle.get(placement.article.articleNumber) ?? null;
    placementsByLocation.get(code).push({
      articleNumber: placement.article.articleNumber,
      name: placement.article.name,
      weightKg: placement.article.weightKg,
      pickFrequency: statistics?.pickFrequency ?? 0,
      priorityScore: evaluation?.priorityScore ?? null,
      placementGap: evaluation?.placementGap ?? null,
    });
  }

  const allArticles = [...placementsByLocation.values()].flat();
  const maximumFrequency = Math.max(0, ...allArticles.map((article) => article.pickFrequency));
  const maximumWeight = Math.max(0, ...allArticles.map((article) => article.weightKg));
  const pickZones = new Map();

  for (const sequenceEntry of analysis.warehouse.pickSequence) {
    const location = sequenceEntry.location;
    const pickZone = location.pickZoneType;
    if (!pickZones.has(pickZone)) pickZones.set(pickZone, new Map());
    const zones = pickZones.get(pickZone);
    if (!zones.has(location.zone)) zones.set(location.zone, new Map());
    const bays = zones.get(location.zone);
    if (!bays.has(location.bay)) {
      bays.set(location.bay, {
        bay: location.bay,
        zone: location.zone,
        pickZone,
        sequence: sequenceEntry.pickSequence,
        locations: [],
      });
    }
    bays.get(location.bay).locations.push({
      locationCode: location.locationCode,
      shelf: location.shelf,
      position: location.position,
      dimensions: {
        heightCm: location.heightCm,
        widthCm: location.widthCm,
        depthCm: location.depthCm,
      },
      height: analysis.warehouse.shelfHeights?.get(location.locationCode) ?? null,
      articles: placementsByLocation.get(location.locationCode) ?? [],
    });
  }

  const pickZoneOrder = ["KOLONIAL", "KYLT", "GRÖNSAKER", "FRYS", "SPRIT", "OTHER"];
  const result = [...pickZones].map(([name, zoneMap]) => ({
    name,
    zones: [...zoneMap].map(([zone, bayMap]) => ({
      zone,
      bays: [...bayMap.values()]
        .toSorted((a, b) => a.bay.localeCompare(b.bay, "sv", { numeric: true }))
        .map((bay) => {
          const articles = bay.locations.flatMap((location) => location.articles);
          const max = (selector) => Math.max(0, ...articles.map(selector).filter(Number.isFinite));
          return {
            ...bay,
            articleCount: articles.length,
            occupiedLocations: bay.locations.filter((location) => location.articles.length > 0).length,
            metrics: {
              priority: max((article) => article.priorityScore),
              frequency: normalize(max((article) => article.pickFrequency), maximumFrequency),
              weight: normalize(max((article) => article.weightKg), maximumWeight),
              gap: max((article) => Math.abs(article.placementGap ?? 0)),
            },
          };
        }),
    })).toSorted((a, b) => a.zone.localeCompare(b.zone, "sv", { numeric: true })),
  })).toSorted((a, b) => {
    const aIndex = pickZoneOrder.indexOf(a.name);
    const bIndex = pickZoneOrder.indexOf(b.name);
    return (aIndex < 0 ? pickZoneOrder.length : aIndex) -
      (bIndex < 0 ? pickZoneOrder.length : bIndex) ||
      a.name.localeCompare(b.name, "sv");
  });

  return {
    pickZones: result,
    summary: {
      pickZones: result.length,
      physicalZones: result.reduce((sum, pickZone) => sum + pickZone.zones.length, 0),
      bays: result.reduce((sum, pickZone) => sum + pickZone.zones.reduce((zoneSum, zone) => zoneSum + zone.bays.length, 0), 0),
      pickLocations: analysis.warehouse.pickSequence.length,
      placedArticles: allArticles.length,
      dimensionedLocations: analysis.warehouse.pickSequence.filter((entry) => (
        [entry.location.heightCm, entry.location.widthCm, entry.location.depthCm].every(Number.isFinite)
      )).length,
    },
  };
}
