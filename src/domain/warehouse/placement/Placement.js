export class Placement {
  constructor({ article, location }) {
    if (!article) {
      throw new Error("Placement requires an article.");
    }

    if (!location) {
      throw new Error("Placement requires a location.");
    }

    if (article.temperatureZone !== location.temperatureZone) {
      throw new Error(
        `Article ${article.articleNumber} cannot be placed in ${location.locationCode}: temperature zones do not match.`,
      );
    }

    this.article = article;
    this.location = location;
  }
}