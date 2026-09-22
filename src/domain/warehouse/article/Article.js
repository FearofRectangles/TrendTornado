import { TemperatureZone } from "../../shared/TemperatureZone.js";

export class Article {
  constructor({
    articleNumber,
    name,
    weightKg,
    temperatureZone,
    category = null,
    baseUnit = null,
    heightCm = null,
    widthCm = null,
    depthCm = null,
  }) {
    this.#assertValidArticleNumber(articleNumber);
    this.#assertValidName(name);
    this.#assertValidWeight(weightKg);
    this.#assertValidTemperatureZone(temperatureZone);

    this.articleNumber = articleNumber;
    this.name = name;
    this.weightKg = weightKg;
    this.temperatureZone = temperatureZone;
    this.category = category;
    this.baseUnit = baseUnit?.trim() || null;
    this.heightCm = this.#optionalDimension(heightCm, "height");
    this.widthCm = this.#optionalDimension(widthCm, "width");
    this.depthCm = this.#optionalDimension(depthCm, "depth");
  }

  #assertValidArticleNumber(articleNumber) {
    if (typeof articleNumber !== "string" || articleNumber.trim() === "") {
      throw new Error("Article number must be a non-empty string.");
    }
  }

  #assertValidName(name) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("Article name must be a non-empty string.");
    }
  }

  #assertValidWeight(weightKg) {
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      throw new Error("Article weight must be a non-negative number.");
    }
  }

  #assertValidTemperatureZone(temperatureZone) {
    const validZones = Object.values(TemperatureZone);

    if (!validZones.includes(temperatureZone)) {
      throw new Error(
        `Invalid temperature zone. Expected one of: ${validZones.join(", ")}.`,
      );
    }
  }

  #optionalDimension(value, name) {
    if (value === null || value === undefined || value === "") return null;
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Article ${name} must be greater than zero.`);
    }
    return value;
  }
}
