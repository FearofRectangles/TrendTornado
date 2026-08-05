import { Article } from "./domain/warehouse/article/Article.js";
import { TemperatureZone } from "./domain/shared/TemperatureZone.js";

const coffee = new Article({
  articleNumber: "10054",
  name: "Kaffe 500 g",
  weightKg: 0.5,
  temperatureZone: TemperatureZone.KOL,
  category: "Coffee",
});

console.log(coffee);