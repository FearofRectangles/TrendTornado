import { Location } from "../../../domain/warehouse/location/Location.js";
import { LocationPurpose } from "../../../domain/shared/LocationPurpose.js";

export function mapLocationCsvRow(row) {
  return new Location({
    locationCode: row.Lokation,
    purpose: mapLocationPurpose(row.Lager_DelOmråde),
    heightCm: parseDimension(row.Højde),
    widthCm: parseDimension(row.Bredde),
    depthCm: parseDimension(row.Længde),
  });
}

function parseDimension(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

function mapLocationPurpose(subArea) {
  if (typeof subArea !== "string") {
    return LocationPurpose.OTHER;
  }

  if (subArea.includes("_Plock")) {
    return LocationPurpose.PICK;
  }

  if (subArea.includes("_Buffer")) {
    return LocationPurpose.BUFFER;
  }

  return LocationPurpose.OTHER;
}
