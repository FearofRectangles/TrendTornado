export class Article {
  constructor({ articleNumber, name, weightKg, temperatureZone }) {
    if (!articleNumber) {
      throw new Error("Article requires an article number.");
    }

    if (!name) {
      throw new Error("Article requires a name.");
    }

    if (!Number.isFinite(weightKg) || weightKg < 0) {
      throw new Error("Article weight must be a non-negative number.");
    }

    if (!temperatureZone) {
      throw new Error("Article requires a temperature zone.");
    }

    this.articleNumber = articleNumber;
    this.name = name;
    this.weightKg = weightKg;
    this.temperatureZone = temperatureZone;
  }
}