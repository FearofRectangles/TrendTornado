function dimensionsAvailable(item) {
  return [item?.heightCm, item?.widthCm, item?.depthCm].every(Number.isFinite);
}

function fitArticle(article, location, { heightOverrideCm = location.heightCm } = {}) {
  if (!dimensionsAvailable(article) || !dimensionsAvailable(location) || !Number.isFinite(heightOverrideCm)) {
    return { fits: false, dataQuality: "UNKNOWN", rotated: false, estimatedCapacity: null };
  }
  const orientations = [
    { width: article.widthCm, depth: article.depthCm, rotated: false },
    { width: article.depthCm, depth: article.widthCm, rotated: true },
  ];
  const feasible = orientations.filter((orientation) => (
    article.heightCm <= heightOverrideCm &&
    orientation.width <= location.widthCm &&
    orientation.depth <= location.depthCm
  )).map((orientation) => ({
    ...orientation,
    capacity: Math.floor(location.widthCm / orientation.width) *
      Math.floor(location.depthCm / orientation.depth) *
      Math.floor(heightOverrideCm / article.heightCm),
  })).toSorted((a, b) => b.capacity - a.capacity);
  return feasible.length === 0
    ? { fits: false, dataQuality: "ESTIMATED", rotated: false, estimatedCapacity: 0 }
    : { fits: true, dataQuality: "ESTIMATED", rotated: feasible[0].rotated, estimatedCapacity: feasible[0].capacity };
}

export function createPlacementOptionFinder({
  locations,
  placements,
  pickSequence,
  weeklyQuantityByArticle = new Map(),
  maximumBeamAdjustmentCm = 20,
  targetRadius = 0.10,
}) {
  if (!Array.isArray(locations) || !Array.isArray(placements) || !Array.isArray(pickSequence)) {
    throw new TypeError("Locations, placements and pick sequence must be arrays.");
  }
  const positionByLocation = new Map(pickSequence.map((entry) => [entry.location.locationCode, entry.relativePickPosition]));
  const occupiedByLocation = new Map();
  for (const placement of placements) {
    const code = placement.location.locationCode;
    if (!occupiedByLocation.has(code)) occupiedByLocation.set(code, []);
    occupiedByLocation.get(code).push(placement.article);
  }
  const pickLocationsByZone = new Map();
  for (const location of locations.filter((item) => item.isPickLocation)) {
    if (!pickLocationsByZone.has(location.pickZoneType)) pickLocationsByZone.set(location.pickZoneType, []);
    pickLocationsByZone.get(location.pickZoneType).push(location);
  }
  const locationsByBayShelf = new Map();
  for (const location of locations) {
    const key = `${location.zone}-${location.bay}`;
    if (!locationsByBayShelf.has(key)) locationsByBayShelf.set(key, new Map());
    const shelves = locationsByBayShelf.get(key);
    if (!shelves.has(location.shelf)) shelves.set(location.shelf, []);
    shelves.get(location.shelf).push(location);
  }

  function capacityDetails(article, location, fit) {
    const weeklyQuantity = weeklyQuantityByArticle.get(article.articleNumber) ?? 0;
    const daysOfDemand = weeklyQuantity > 0 && fit.estimatedCapacity !== null
      ? fit.estimatedCapacity / (weeklyQuantity / 7)
      : null;
    return { ...fit, weeklyQuantity, estimatedDaysOfDemand: daysOfDemand, baseUnit: article.baseUnit };
  }

  function canAdjustBeam(article, location) {
    if (!dimensionsAvailable(article) || !dimensionsAvailable(location)) return null;
    if (article.widthCm > location.widthCm && article.depthCm > location.widthCm) return null;
    const orientationFits = (
      (article.widthCm <= location.widthCm && article.depthCm <= location.depthCm) ||
      (article.depthCm <= location.widthCm && article.widthCm <= location.depthCm)
    );
    if (!orientationFits || article.heightCm <= location.heightCm) return null;
    const adjustmentCm = article.heightCm - location.heightCm;
    if (adjustmentCm > maximumBeamAdjustmentCm) return null;
    const shelves = locationsByBayShelf.get(`${location.zone}-${location.bay}`);
    const ordered = [...shelves.keys()].toSorted((a, b) => a.localeCompare(b, "sv", { numeric: true }));
    const nextShelf = ordered[ordered.indexOf(location.shelf) + 1];
    if (!nextShelf) return null;
    const aboveLocations = shelves.get(nextShelf);
    const aboveStillFits = aboveLocations.every((aboveLocation) => {
      const remainingHeight = (aboveLocation.heightCm ?? 0) - adjustmentCm;
      if (remainingHeight <= 0) return false;
      return (occupiedByLocation.get(aboveLocation.locationCode) ?? []).every((occupant) => (
        dimensionsAvailable(occupant) && occupant.heightCm <= remainingHeight
      ));
    });
    return aboveStillFits ? adjustmentCm : null;
  }

  return function findOptions({ article, currentLocation, desiredPosition }) {
    const targetInterval = {
      start: Math.max(0, desiredPosition - targetRadius),
      end: Math.min(1, desiredPosition + targetRadius),
    };
    const candidates = pickLocationsByZone.get(currentLocation.pickZoneType) ?? [];
    const base = (location) => {
      const relativePosition = positionByLocation.get(location.locationCode);
      return {
        locationCode: location.locationCode,
        zone: location.zone,
        bay: location.bay,
        shelf: location.shelf,
        relativePosition,
        distanceFromTarget: Number.isFinite(relativePosition) ? Math.abs(relativePosition - desiredPosition) : 1,
        withinTargetInterval: Number.isFinite(relativePosition) && relativePosition >= targetInterval.start && relativePosition <= targetInterval.end,
        dimensions: { heightCm: location.heightCm, widthCm: location.widthCm, depthCm: location.depthCm },
      };
    };
    const direct = [];
    const swaps = [];
    const adjustments = [];
    for (const location of candidates) {
      if (location.locationCode === currentLocation.locationCode) continue;
      const occupants = occupiedByLocation.get(location.locationCode) ?? [];
      const fit = fitArticle(article, location);
      if (occupants.length === 0 && fit.fits) {
        direct.push({ type: "DIRECT", ...base(location), capacity: capacityDetails(article, location, fit) });
      } else if (occupants.length === 1 && fit.fits) {
        const displacedArticle = occupants[0];
        const reverseFit = fitArticle(displacedArticle, currentLocation);
        if (reverseFit.fits) {
          swaps.push({ type: "SWAP", ...base(location), capacity: capacityDetails(article, location, fit), displacedArticle: { articleNumber: displacedArticle.articleNumber, name: displacedArticle.name } });
        }
      } else if (occupants.length === 0) {
        const adjustmentCm = canAdjustBeam(article, location);
        if (adjustmentCm !== null) {
          const adjustedFit = fitArticle(article, location, { heightOverrideCm: location.heightCm + adjustmentCm });
          adjustments.push({ type: "BEAM_ADJUSTMENT", ...base(location), adjustmentCm, capacity: capacityDetails(article, location, adjustedFit) });
        }
      }
    }
    const rank = (left, right) => (
      Number(right.withinTargetInterval) - Number(left.withinTargetInterval) ||
      left.distanceFromTarget - right.distanceFromTarget ||
      (right.capacity.estimatedDaysOfDemand ?? -1) - (left.capacity.estimatedDaysOfDemand ?? -1)
    );
    return {
      targetInterval,
      articleDimensions: { heightCm: article.heightCm, widthCm: article.widthCm, depthCm: article.depthCm },
      baseUnit: article.baseUnit,
      dataQuality: dimensionsAvailable(article) ? "ESTIMATED" : "UNKNOWN",
      direct: direct.toSorted(rank).slice(0, 3),
      swaps: swaps.toSorted(rank).slice(0, 3),
      adjustments: adjustments.toSorted(rank).slice(0, 3),
    };
  };
}

export { fitArticle };
