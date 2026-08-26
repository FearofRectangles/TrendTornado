export function buildPickSequence(locations) {
  if (!Array.isArray(locations)) {
    throw new TypeError("Locations must be an array.");
  }

  const pickLocations = locations.filter(
    (location) => location.isPickLocation,
  );

  const locationsByPickZone = new Map();

  for (const location of pickLocations) {
    const pickZoneType = location.pickZoneType;

    if (!locationsByPickZone.has(pickZoneType)) {
      locationsByPickZone.set(
        pickZoneType,
        [],
      );
    }

    locationsByPickZone
      .get(pickZoneType)
      .push(location);
  }

  const result = [];

  for (
    const [pickZoneType, zoneLocations]
    of locationsByPickZone
  ) {
    const sortedLocations =
      zoneLocations.toSorted(
        (a, b) =>
          a.locationCode.localeCompare(
            b.locationCode,
          ),
      );

    const totalLocations =
      sortedLocations.length;

    for (
      const [index, location]
      of sortedLocations.entries()
    ) {
      const relativePickPosition =
        totalLocations <= 1
          ? 0
          : index / (totalLocations - 1);

      result.push({
        location,
        pickZoneType,

        pickSequence: index + 1,

        totalPickLocations:
          totalLocations,

        relativePickPosition,
      });
    }
  }

  return result;
}