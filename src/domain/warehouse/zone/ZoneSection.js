export const ZoneSection = Object.freeze({
  BEGINNING: "BEGINNING",
  MIDDLE: "MIDDLE",
  END: "END",
});

export function getZoneSection(relativePosition) {
  if (
    !Number.isFinite(relativePosition) ||
    relativePosition < 0 ||
    relativePosition > 1
  ) {
    throw new Error(
      "Relative position must be a number between 0 and 1.",
    );
  }

  if (relativePosition < 1 / 3) {
    return ZoneSection.BEGINNING;
  }

  if (relativePosition < 2 / 3) {
    return ZoneSection.MIDDLE;
  }

  return ZoneSection.END;
}