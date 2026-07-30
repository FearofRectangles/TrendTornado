import { Article } from "./domain/warehouse/article/Article.js";
import { Location } from "./domain/warehouse/location/Location.js";
import { Placement } from "./domain/warehouse/placement/Placement.js";

const coffee = new Article({
  articleNumber: "10054",
  name: "Kaffe 500 g",
  weightKg: 0.5,
  temperatureZone: "DRY",
});

const locationA03 = new Location({
  locationCode: "A03-02",
  pickSequence: 3,
  temperatureZone: "DRY",
  shelfLevel: "GOOD",
});

const placement = new Placement({
  article: coffee,
  location: locationA03,
});

console.log(
  `${placement.article.name} is placed at ${placement.location.locationCode}`,
);