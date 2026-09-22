import { DEFAULT_SETTINGS } from "../../../config/DefaultSettings.js";

let zoneProfiles = DEFAULT_SETTINGS.warehouse.zoneMappings.map((mapping) => ({ ...mapping }));

export function configureZoneMappings(mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) throw new Error("Zone mappings are required.");
  zoneProfiles = mappings.map((mapping) => ({
    physicalZone: String(mapping.physicalZone).padStart(2, "0"),
    temperatureZone: String(mapping.temperatureZone),
    pickZoneType: String(mapping.pickZoneType),
  }));
}

export function getZoneProfiles() {
  return zoneProfiles.map((profile) => ({ ...profile }));
}

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

  const profile = zoneProfiles.find(({ physicalZone }) => physicalZone === zoneCode);

  if (!profile) {
    throw new Error(
      `No zone profile configured for zone ${zoneCode}.`,
    );
  }

  return profile;
}
