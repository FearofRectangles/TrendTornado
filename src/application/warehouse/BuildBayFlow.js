export function buildBayFlow(locations) {
  if (!Array.isArray(locations)) {
    throw new TypeError(
      "Locations must be an array.",
    );
  }

  const uniqueBays = new Map();

  for (const location of locations) {
    if (!location.isPickLocation) {
      continue;
    }

    const key =
      `${location.pickZoneType}:${location.zone}:${location.bay}`;

    if (!uniqueBays.has(key)) {
      uniqueBays.set(key, {
        pickZoneType:
          location.pickZoneType,

        zone:
          location.zone,

        bay:
          location.bay,
      });
    }
  }

  const groupedByPickZone =
    new Map();

  for (const bay of uniqueBays.values()) {
    if (
      !groupedByPickZone.has(
        bay.pickZoneType,
      )
    ) {
      groupedByPickZone.set(
        bay.pickZoneType,
        [],
      );
    }

    groupedByPickZone
      .get(bay.pickZoneType)
      .push(bay);
  }

  const result = [];

  for (
    const [pickZoneType, bays]
    of groupedByPickZone
  ) {
    const sortedBays =
      bays.toSorted(
        (a, b) => {
          const zoneComparison =
            a.zone.localeCompare(
              b.zone,
            );

          if (
            zoneComparison !== 0
          ) {
            return zoneComparison;
          }

          return a.bay.localeCompare(
            b.bay,
          );
        },
      );

    const totalBays =
      sortedBays.length;

    for (
      const [index, bay]
      of sortedBays.entries()
    ) {
      result.push({
        ...bay,

        sequence:
          index + 1,

        totalBays,

        relativePosition:
          totalBays <= 1
            ? 0
            : index /
              (totalBays - 1),
      });
    }
  }

  return result;
}