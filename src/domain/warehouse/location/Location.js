export class Location {
  constructor({
    locationCode,
    pickSequence,
    temperatureZone,
    shelfLevel,
  }) {
    if (!locationCode) {
      throw new Error("Location requires a location code.");
    }

    if (!Number.isInteger(pickSequence) || pickSequence < 1) {
      throw new Error("Pick sequence must be a positive integer.");
    }

    if (!temperatureZone) {
      throw new Error("Location requires a temperature zone.");
    }

    if (!shelfLevel) {
      throw new Error("Location requires a shelf level.");
    }

    this.locationCode = locationCode;
    this.pickSequence = pickSequence;
    this.temperatureZone = temperatureZone;
    this.shelfLevel = shelfLevel;
  }
}