import test from "node:test";
import assert from "node:assert/strict";
import { WarehouseSimulationEngine } from "../../domain/simulation/WarehouseSimulationEngine.js";
import { ProjectedLayoutBuilder } from "../../domain/simulation/ProjectedLayoutBuilder.js";
import { RelocationImpactEngine } from "./RelocationImpactEngine.js";

const orders = [
  {
    documentNumber: "O1",
    picks: [
      { articleNumber: "A", pickedQuantity: 1, weightKg: 10, relativePosition: 0.9 },
      { articleNumber: "B", pickedQuantity: 1, weightKg: 2, relativePosition: 0.2 },
    ],
  },
  {
    documentNumber: "O2",
    picks: [
      { articleNumber: "A", pickedQuantity: 1, weightKg: 10, relativePosition: 0.9 },
      { articleNumber: "C", pickedQuantity: 1, weightKg: 1, relativePosition: 0.3 },
    ],
  },
];

const recommendations = [
  { article: { articleNumber: "A" }, evaluation: { articleNumber: "A", currentPosition: 0.9, desiredPosition: 0.1, placementGap: 0.8 }, placementOptions: { direct: [{ locationCode: "L1", relativePosition: 0.1, capacity: { estimatedCapacity: 10, estimatedDaysOfDemand: 7 } }], swaps: [], adjustments: [] } },
  { article: { articleNumber: "B" }, evaluation: { articleNumber: "B", currentPosition: 0.2, desiredPosition: 0.8, placementGap: -0.6 }, placementOptions: { direct: [{ locationCode: "L2", relativePosition: 0.8, capacity: { estimatedCapacity: 10, estimatedDaysOfDemand: 7 } }], swaps: [], adjustments: [] } },
];

test("calculates concrete shadow impact and builds a non-overlapping marginal portfolio", () => {
  const baselineSimulation = WarehouseSimulationEngine.simulate({ orders });
  const projectedOrders = ProjectedLayoutBuilder.build({
    historicalOrders: orders,
    evaluations: recommendations.map((item) => item.evaluation),
    movementThreshold: 0.2,
  });
  const optimizedSimulation = WarehouseSimulationEngine.simulate({ orders: projectedOrders });
  const result = RelocationImpactEngine.analyze({
    historicalOrders: orders,
    recommendations,
    baselineSimulation,
    optimizedSimulation,
  });

  const impactA = result.individualImpacts.find((item) => item.articleNumber === "A");
  assert.equal(impactA.affectedDocuments, 2);
  assert.ok(impactA.spanImprovement > 0);
  assert.ok(impactA.weightOrderImprovement > 0);
  assert.equal(result.portfolio.items[0].articleNumber, "A");
  assert.equal(result.portfolio.items[0].actionType, "DIRECT");
  assert.equal(result.portfolio.items[0].targetLocationCode, "L1");
  assert.ok(result.portfolio.realizedPotentialShare > 0);
  assert.ok(result.portfolio.items.every((item) => item.spanImprovement >= 0));
  assert.ok(result.portfolio.items.every((item) => item.weightOrderImprovement >= 0));
});

test("keeps theoretical effects out of the operational portfolio", () => {
  const baselineSimulation = WarehouseSimulationEngine.simulate({ orders });
  const result = RelocationImpactEngine.analyze({
    historicalOrders: orders,
    recommendations: [{
      article: { articleNumber: "A" },
      evaluation: { articleNumber: "A", currentPosition: 0.9, desiredPosition: 0.1, placementGap: 0.8 },
      placementOptions: { dataQuality: "UNKNOWN", direct: [], swaps: [], adjustments: [] },
    }],
    baselineSimulation,
    optimizedSimulation: baselineSimulation,
  });

  assert.equal(result.individualImpacts[0].actionType, "THEORETICAL");
  assert.equal(result.portfolio.items.length, 0);
  assert.equal(result.portfolio.theoreticalCandidateCount, 1);
  assert.equal(result.portfolio.missingDimensionCandidateCount, 1);
  assert.equal(result.portfolio.noFeasibleLocationCandidateCount, 0);
  assert.equal(result.analyticalPortfolio.items[0].articleNumber, "A");
  assert.equal(result.analyticalPortfolio.basis, "MIXED_WITH_THEORETICAL_FALLBACK");
});
