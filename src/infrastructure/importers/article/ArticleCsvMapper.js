import { Article } from "../../../domain/warehouse/article/Article.js";
import { TemperatureZone } from "../../../domain/shared/TemperatureZone.js";

export function mapArticleCsvRow(row) {
  return new Article({
    articleNumber: row.Nr,
    name: row.Beskrivning,
    weightKg: Number(row.Nettovikt),
    temperatureZone: mapStorageType(row.Förvaringstyp),
  });
}

function mapStorageType(storageType) {
  switch (storageType) {
    case "Kolonial":
      return TemperatureZone.KOL;

    case "Kylt":
    case "Kyld":
      return TemperatureZone.KYLD;

    case "Fryst":
      return TemperatureZone.FRYST;

    case "Grönsaker":
      return TemperatureZone.GRÖNSAKER;

    case "Sprit":
      return TemperatureZone.SPRIT;

    default:
      throw new Error(`Unknown storage type: ${storageType}`);
  }
}