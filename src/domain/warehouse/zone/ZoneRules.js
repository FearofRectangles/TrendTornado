import { TemperatureZone } from "../../shared/TemperatureZone.js";
import { PickZoneType } from "../../shared/PickZoneType.js";

const zoneProfiles = Object.freeze([
  {
    from: 1,
    to: 9,
    temperatureZone: TemperatureZone.KOL,
    pickZoneType: PickZoneType.KOLONIAL,
  },
  {
    from: 11,
    to: 14,
    temperatureZone: TemperatureZone.KYLD,
    pickZoneType: PickZoneType.KYLT,
  },
  {
    from: 20,
    to: 22,
    temperatureZone: TemperatureZone.KYLD,
    pickZoneType: PickZoneType.GRONSAKER,
  },
  {
    from: 30,
    to: 39,
    temperatureZone: TemperatureZone.FRYST,
    pickZoneType: PickZoneType.FRYS,
  },
]);

export function getTemperatureZoneFromZoneCode(zoneCode) {
  return getZoneProfile(zoneCode).temperatureZone;
}

export function getPickZoneTypeFromZoneCode(zoneCode) {
  return getZoneProfile(zoneCode).pickZoneType;
}

function getZoneProfile(zoneCode) {
  if (
    typeof zoneCode !== "string" ||
    !/^\d{2}$/.test(zoneCode)
  ) {
    throw new Error(
      "Zone code must be a two-digit string.",
    );
  }

  const numericZoneCode = Number(zoneCode);

  const profile = zoneProfiles.find(
    ({ from, to }) =>
      numericZoneCode >= from &&
      numericZoneCode <= to,
  );

  if (!profile) {
    throw new Error(
      `No zone profile configured for zone ${zoneCode}.`,
    );
  }

  return profile;
}