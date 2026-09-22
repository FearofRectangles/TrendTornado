import { Article } from "../../../domain/warehouse/article/Article.js";
import { TemperatureZone } from "../../../domain/shared/TemperatureZone.js";

export function mapArticleCsvRow(row) {
  return new Article({
    articleNumber: row.Nr,
    name: row.Beskrivning,
    weightKg: parseWeight(row.Nettovikt, row.Nr),
    temperatureZone: mapStorageType(row.Förvaringstyp),
    category: row.Produktgruppkod?.trim() || null,
    baseUnit: row.Basenhet,
    heightCm: parseDimension(row["Höjd (cm)"]),
    widthCm: parseDimension(row["Bredd (cm)"]),
    depthCm: parseDimension(row["Djup (cm)"]),
  });
}

function parseDimension(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const dimension = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(dimension) && dimension > 0 ? dimension : null;
}

function mapStorageType(storageType) {
  switch (storageType) {
    case "Kolonial":
      return TemperatureZone.KOL;

    case "Kylt":
    case "Kyld":
    case "Kyl":
      return TemperatureZone.KYLD;

    case "Fryst":
    case "Frys":
      return TemperatureZone.FRYST;


    default:
      throw new Error(`Unknown storage type: ${storageType}`);
  }
}

function parseWeight(value, articleNumber) {
  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  const weight = Number(normalized);

  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error(
      `Invalid weight for article ${articleNumber}: "${value}"`,
    );
  }

  return weight;
}

