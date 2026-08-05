import { Article } from "../article/Article.js";
import { Location } from "../location/Location.js";

export class Placement {
  constructor({ article, location }) {
    this.#assertValidArticle(article);
    this.#assertValidLocation(location);
    this.#assertMatchingTemperatureZones(article, location);

    this.article = article;
    this.location = location;
  }

  #assertValidArticle(article) {
    if (!(article instanceof Article)) {
      throw new TypeError("Placement requires a valid Article.");
    }
  }

  #assertValidLocation(location) {
    if (!(location instanceof Location)) {
      throw new TypeError("Placement requires a valid Location.");
    }
  }

  #assertMatchingTemperatureZones(article, location) {
    if (article.temperatureZone !== location.temperatureZone) {
      throw new Error(
        `Article ${article.articleNumber} cannot be placed at ` +
          `${location.locationCode}: temperature zones do not match.`,
      );
    }
  }
}