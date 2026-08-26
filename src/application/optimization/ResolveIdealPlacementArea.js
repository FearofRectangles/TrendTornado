import {
  getZoneSection,
} from "../../domain/warehouse/zone/ZoneSection.js";

export function resolveIdealPlacementArea({
  desiredPosition,
  pickZoneType,
  bayFlow,
}) {
  if (
    !Number.isFinite(
      desiredPosition,
    ) ||
    desiredPosition < 0 ||
    desiredPosition > 1
  ) {
    throw new Error(
      "Desired position must be between 0 and 1.",
    );
  }

  if (
    typeof pickZoneType !==
      "string" ||
    pickZoneType.trim() === ""
  ) {
    throw new Error(
      "Pick zone type is required.",
    );
  }

  if (!Array.isArray(bayFlow)) {
    throw new TypeError(
      "Bay flow must be an array.",
    );
  }

  const flow =
    bayFlow.filter(
      (entry) =>
        entry.pickZoneType ===
        pickZoneType,
    );

  if (flow.length === 0) {
    return null;
  }

  const targetIndex =
    Math.round(
      desiredPosition *
        (flow.length - 1),
    );

  const targetBay =
    flow[targetIndex];

  const baysInPhysicalZone =
    flow.filter(
      (entry) =>
        entry.zone ===
        targetBay.zone,
    );

  const bayIndexWithinZone =
    baysInPhysicalZone.findIndex(
      (entry) =>
        entry.bay ===
        targetBay.bay,
    );

  const relativeZonePosition =
    baysInPhysicalZone.length <= 1
      ? 0
      : bayIndexWithinZone /
        (
          baysInPhysicalZone.length -
          1
        );

  return {
    pickZoneType,

    zone:
      targetBay.zone,

    section:
      getZoneSection(
        relativeZonePosition,
      ),

    relativeZonePosition,

    targetBay:
      targetBay.bay,

    targetSequence:
      targetBay.sequence,

    totalBays:
      targetBay.totalBays,
  };
}