export function buildShelfHeights(locations, { beamThicknessCm = 12 } = {}) {
  if (!Array.isArray(locations)) throw new TypeError("Locations must be an array.");
  if (!Number.isFinite(beamThicknessCm) || beamThicknessCm < 0) {
    throw new Error("Beam thickness must be zero or greater.");
  }

  const locationsByBay = new Map();
  for (const location of locations) {
    const key = `${location.zone}-${location.bay}`;
    if (!locationsByBay.has(key)) locationsByBay.set(key, []);
    locationsByBay.get(key).push(location);
  }

  const byLocationCode = new Map();
  for (const bayLocations of locationsByBay.values()) {
    const shelves = new Map();
    for (const location of bayLocations) {
      if (!shelves.has(location.shelf)) shelves.set(location.shelf, []);
      shelves.get(location.shelf).push(location);
    }
    let floorHeightCm = 0;
    let cumulativeHeightKnown = true;
    const orderedShelves = [...shelves].toSorted(([left], [right]) => (
      left.localeCompare(right, "sv", { numeric: true })
    ));
    for (const [shelf, shelfLocations] of orderedShelves) {
      const knownHeights = shelfLocations.map((location) => location.heightCm).filter(Number.isFinite);
      const clearHeightCm = knownHeights.length > 0 ? Math.max(...knownHeights) : null;
      for (const location of shelfLocations) {
        byLocationCode.set(location.locationCode, {
          shelf,
          floorHeightCm: cumulativeHeightKnown ? floorHeightCm : null,
          topHeightCm: cumulativeHeightKnown && location.heightCm !== null ? floorHeightCm + location.heightCm : null,
          clearHeightCm: location.heightCm,
          shelfClearHeightCm: clearHeightCm,
          beamThicknessCm,
          volumeM3: [location.heightCm, location.widthCm, location.depthCm].every(Number.isFinite)
            ? location.heightCm * location.widthCm * location.depthCm / 1_000_000
            : null,
        });
      }
      if (clearHeightCm !== null && cumulativeHeightKnown) floorHeightCm += clearHeightCm + beamThicknessCm;
      else cumulativeHeightKnown = false;
    }
  }
  return byLocationCode;
}
