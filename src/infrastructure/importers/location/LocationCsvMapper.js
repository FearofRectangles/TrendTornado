import { Location } from "../../../domain/warehouse/location/Location.js";
import { LocationPurpose } from "../../../domain/shared/LocationPurpose.js";

export function mapLocationCsvRow(row) {
  return new Location({
    locationCode: row.Lokation,
    purpose: mapLocationPurpose(row.Lager_DelOmråde),
  });
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