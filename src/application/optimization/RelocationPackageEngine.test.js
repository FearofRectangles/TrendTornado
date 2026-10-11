import test from "node:test";
import assert from "node:assert/strict";
import { WarehouseSimulationEngine } from "../../domain/simulation/WarehouseSimulationEngine.js";
import { RelocationPackageEngine } from "./RelocationPackageEngine.js";

const location = (locationCode, relativePosition) => ({
  locationCode,
  relativePosition,
  pickZoneType: "KOLONIAL",
  heightCm: 50,
  widthCm: 50,
  depthCm: 50,
});
const article = (articleNumber, name) => ({
  articleNumber,
  name,
  heightCm: 20,
  widthCm: 20,
  depthCm: 20,
  pickedQuantityPerWeek: 7,
  baseUnit: "ST",
});

test("builds an ordered package that reuses the location freed by the prior move", () => {
  const orders = [{
    documentNumber: "O1",
    picks: [
      { articleNumber: "A", pickedQuantity: 1, weightKg: 10, relativePosition: 0.4 },
      { articleNumber: "B", pickedQuantity: 1, weightKg: 5, relativePosition: 0.9 },
      { articleNumber: "C", pickedQuantity: 1, weightKg: 1, relativePosition: 0.1 },
    ],
  }];
  const recommendations = [
    {
      article: article("A", "Artikel A"), currentLocation: location("L-A", 0.4),
      evaluation: { articleNumber: "A", currentPosition: 0.4, desiredPosition: 0.1, placementGap: 0.3 },
      recommendedArea: { zone: "01", section: "BEGINNING" },
      placementOptions: { dataQuality: "ESTIMATED", direct: [{ locationCode: "EMPTY", relativePosition: 0.1, dimensions: { heightCm: 50, widthCm: 50, depthCm: 50 } }] },
    },
    {
      article: article("B", "Artikel B"), currentLocation: location("L-B", 0.9),
      evaluation: { articleNumber: "B", currentPosition: 0.9, desiredPosition: 0.4, placementGap: 0.5 },
      recommendedArea: { zone: "01", section: "BEGINNING" },
      placementOptions: { dataQuality: "ESTIMATED", direct: [] },
    },
  ];
  const result = RelocationPackageEngine.analyze({
    historicalOrders: orders,
    recommendations,
    baselineSimulation: WarehouseSimulationEngine.simulate({ orders }),
    weeklyQuantityByArticle: new Map([["A", 7], ["B", 7]]),
  });
  const packagePlan = result.packages[0];
  assert.equal(packagePlan.steps[0].toLocationCode, "EMPTY");
  assert.equal(packagePlan.steps[1].toLocationCode, "L-A");
  assert.equal(packagePlan.finalFreeLocationCode, "L-B");
  assert.equal(packagePlan.steps[1].actionType, "REUSE_FREED_LOCATION");
});
