import { TemperatureZone } from "../../shared/TemperatureZone.js";

const zoneRanges = Object.freeze([
  {
    from: 1,
    to: 9,
    temperatureZone: TemperatureZone.KOL,
  },
  {
    from: 11,
    to: 13,
    temperatureZone: TemperatureZone.KYLD,
  },
]);

export function getTemperatureZoneFromZoneCode(zoneCode) {
  if (typeof zoneCode !== "string" || !/^\d{2}$/.test(zoneCode)) {
    throw new Error("Zone code must be a two-digit string.");
  }

  const numericZoneCode = Number(zoneCode);

  const matchingRange = zoneRanges.find(
    ({ from, to }) =>
      numericZoneCode >= from && numericZoneCode <= to,
  );

  if (!matchingRange) {
    throw new Error(`No temperature zone configured for zone ${zoneCode}.`);
  }

  return matchingRange.temperatureZone;
}