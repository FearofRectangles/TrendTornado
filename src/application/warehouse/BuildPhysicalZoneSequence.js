import {
  getZoneSection,
} from "../../domain/warehouse/zone/ZoneSection.js";

export function buildPhysicalZoneSequence(locations) {
  if (!Array.isArray(locations)) {
    throw new TypeError(
      "Locations must be an array.",
    );
  }

  const pickLocations = locations.filter(
    (location) => location.isPickLocation,
  );

  // Group all PICK locations by physical zone.
  const locationsByZone = new Map();

  for (const location of pickLocations) {
    const zone = location.zone;

    if (!locationsByZone.has(zone)) {
      locationsByZone.set(zone, []);
    }

    locationsByZone
      .get(zone)
      .push(location);
  }

  const result = [];

  for (
    const [zone, zoneLocations]
    of locationsByZone
  ) {
    // --------------------------------------------------
    // A bay represents a physical position in the zone.
    //
    // Several locations can exist in the same bay because
    // it may contain several shelves/positions.
    //
    // They must therefore all receive the same physical
    // position within the zone.
    // --------------------------------------------------

    const uniqueBays = [
      ...new Set(
        zoneLocations.map(
          (location) => location.bay,
        ),
      ),
    ].toSorted(
      (a, b) =>
        a.localeCompare(b),
    );

    const totalZoneBays =
      uniqueBays.length;

    // Quick lookup:
    // bay -> physical index within zone
    const bayIndex = new Map(
      uniqueBays.map(
        (bay, index) => [
          bay,
          index,
        ],
      ),
    );

    for (const location of zoneLocations) {
      const index =
        bayIndex.get(
          location.bay,
        );

      const relativeZonePosition =
        totalZoneBays <= 1
          ? 0
          : index /
            (totalZoneBays - 1);

      result.push({
        location,
        zone,

        bay: location.bay,

        // 1-based human-readable bay sequence.
        baySequence:
          index + 1,

        totalZoneBays,

        relativeZonePosition,

        zoneSection:
          getZoneSection(
            relativeZonePosition,
          ),
      });
    }
  }

  return result;
}