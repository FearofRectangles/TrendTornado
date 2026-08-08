import { LocationPurpose } from "../../shared/LocationPurpose.js";
import { getTemperatureZoneFromZoneCode } from "../zone/ZoneRules.js";

export class Location {
  constructor({
    locationCode,
    purpose,
    ergonomicLevel = null,
  }) {
    this.#assertValidLocationCode(locationCode);
    this.#assertValidPurpose(purpose);

    this.locationCode = locationCode;
    this.purpose = purpose;
    this.ergonomicLevel = ergonomicLevel;
  }

  get zone() {
    return this.locationCode.slice(0, 2);
  }

  get bay() {
    return this.locationCode.slice(2, 5);
  }

  get shelf() {
    return this.locationCode.slice(5, 7);
  }

  get position() {
    return this.locationCode.slice(7, 9);
  }

  get temperatureZone() {
    return getTemperatureZoneFromZoneCode(this.zone);
  }

  get isPickLocation() {
    return this.purpose === LocationPurpose.PICK;
  }

  comesBefore(otherLocation) {
    if (!(otherLocation instanceof Location)) {
      throw new TypeError("Expected another Location.");
    }

    return this.locationCode.localeCompare(otherLocation.locationCode) < 0;
  }

  #assertValidLocationCode(locationCode) {
    if (
      typeof locationCode !== "string" ||
      !/^\d{9}$/.test(locationCode)
    ) {
      throw new Error(
        "Location code must be a 9-digit string in the format XXYYYZZVV.",
      );
    }
  }

  #assertValidPurpose(purpose) {
    const validPurposes = Object.values(LocationPurpose);

    if (!validPurposes.includes(purpose)) {
      throw new Error(
        `Invalid location purpose. Expected one of: ${validPurposes.join(", ")}.`,
      );
    }
  }
}