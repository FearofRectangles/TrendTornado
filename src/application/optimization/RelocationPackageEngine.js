import { OrderSimulationEngine } from "../../domain/simulation/OrderSimulationEngine.js";
import { fitArticle } from "./PlacementOptionFinder.js";

const PACKAGE_SIZES = Object.freeze([
  { key: "SMALL", label: "Litet", maximumSteps: 5 },
  { key: "STANDARD", label: "Standard", maximumSteps: 10 },
  { key: "LARGE", label: "Stort", maximumSteps: 20 },
]);

const OBJECTIVE_WEIGHTS = Object.freeze({ pickSpan: 0.7, weightOrder: 0.3 });

function simulateOrder(order, overrides) {
  return OrderSimulationEngine.simulate({
    documentNumber: order.documentNumber,
    picks: order.picks.map((pick) => ({
      ...pick,
      relativePosition: overrides.get(String(pick.articleNumber)) ?? pick.relativePosition,
    })),
  });
}

function actionGain({ spanImprovement, weightOrderImprovement }) {
  return OBJECTIVE_WEIGHTS.pickSpan * spanImprovement +
    OBJECTIVE_WEIGHTS.weightOrder * weightOrderImprovement;
}

function locationFromOption(option, pickZoneType) {
  return {
    locationCode: option.locationCode,
    relativePosition: option.relativePosition,
    heightCm: option.dimensions?.heightCm ?? null,
    widthCm: option.dimensions?.widthCm ?? null,
    depthCm: option.dimensions?.depthCm ?? null,
    pickZoneType,
  };
}

function capacity(article, location, estimatedCapacity, weeklyQuantity) {
  return {
    estimatedCapacity,
    estimatedDaysOfDemand: weeklyQuantity > 0 && Number.isFinite(estimatedCapacity)
      ? estimatedCapacity / (weeklyQuantity / 7)
      : null,
    weeklyQuantity,
    baseUnit: article.baseUnit ?? null,
    dimensions: {
      heightCm: location.heightCm,
      widthCm: location.widthCm,
      depthCm: location.depthCm,
    },
  };
}

export class RelocationPackageEngine {
  static analyze({ historicalOrders, recommendations, baselineSimulation, weeklyQuantityByArticle = new Map() }) {
    if (!Array.isArray(historicalOrders) || !Array.isArray(recommendations)) {
      throw new TypeError("Historical orders and recommendations must be arrays.");
    }

    const multiPickGroups = baselineSimulation?.multiPickGroups ?? 0;
    const comparablePairs = baselineSimulation?.comparablePairs ?? 0;
    const baselineByOrder = new Map(historicalOrders.map((order) => [order, simulateOrder(order, new Map())]));
    const ordersByArticle = new Map();
    historicalOrders.forEach((order) => {
      new Set(order.picks.map((pick) => String(pick.articleNumber))).forEach((articleNumber) => {
        if (!ordersByArticle.has(articleNumber)) ordersByArticle.set(articleNumber, []);
        ordersByArticle.get(articleNumber).push(order);
      });
    });

    const candidates = recommendations.filter((recommendation) => (
      recommendation.recommendedArea !== null &&
      recommendation.placementOptions?.dataQuality !== "UNKNOWN" &&
      recommendation.currentLocation?.locationCode &&
      Number.isFinite(recommendation.evaluation?.currentPosition)
    ));
    const byPickZone = new Map();
    candidates.forEach((candidate) => {
      const zone = candidate.currentLocation.pickZoneType;
      if (!byPickZone.has(zone)) byPickZone.set(zone, []);
      byPickZone.get(zone).push(candidate);
    });

    const packages = [];
    for (const [pickZone, zoneCandidates] of byPickZone) {
      const overrides = new Map();
      const simulations = new Map(baselineByOrder);
      const usedArticles = new Set();
      const occupiedTargetLocations = new Set();
      const steps = [];
      let freeLocation = null;
      let chainNumber = 0;
      let cumulativeSpanImprovement = 0;
      let cumulativeWeightOrderImprovement = 0;
      let cumulativeObjectiveGain = 0;

      const evaluate = (candidate, targetLocation, fit) => {
        const articleNumber = String(candidate.article.articleNumber);
        const nextOverrides = new Map(overrides).set(articleNumber, targetLocation.relativePosition);
        let spanDelta = 0;
        let correctPairDelta = 0;
        let improvedGroups = 0;
        let worsenedGroups = 0;
        const nextSimulations = new Map();
        const affectedOrders = ordersByArticle.get(articleNumber) ?? [];
        const affectedDocuments = new Set();
        for (const order of affectedOrders) {
          const before = simulations.get(order) ?? baselineByOrder.get(order);
          const after = simulateOrder(order, nextOverrides);
          nextSimulations.set(order, after);
          affectedDocuments.add(order.documentNumber);
          const groupSpanDelta = order.picks.length >= 2 ? after.pickSpan - before.pickSpan : 0;
          const groupPairDelta = after.correctlyOrderedPairs - before.correctlyOrderedPairs;
          spanDelta += groupSpanDelta;
          correctPairDelta += groupPairDelta;
          if (groupSpanDelta < 0 || groupPairDelta > 0) improvedGroups += 1;
          if (groupSpanDelta > 0 || groupPairDelta < 0) worsenedGroups += 1;
        }
        const spanImprovement = multiPickGroups > 0 ? -spanDelta / multiPickGroups : 0;
        const weightOrderImprovement = comparablePairs > 0 ? correctPairDelta / comparablePairs : 0;
        return {
          candidate,
          targetLocation,
          fit,
          spanImprovement,
          weightOrderImprovement,
          objectiveGain: actionGain({ spanImprovement, weightOrderImprovement }),
          affectedDocuments: affectedDocuments.size,
          improvedGroups,
          worsenedGroups,
          nextOverrides,
          nextSimulations,
        };
      };

      while (steps.length < PACKAGE_SIZES.at(-1).maximumSteps) {
        const actions = [];
        for (const candidate of zoneCandidates) {
          const articleNumber = String(candidate.article.articleNumber);
          if (usedArticles.has(articleNumber)) continue;
          if (freeLocation) {
            const fit = fitArticle(candidate.article, freeLocation);
            if (!fit.fits || !Number.isFinite(freeLocation.relativePosition)) continue;
            const currentError = Math.abs(candidate.evaluation.currentPosition - candidate.evaluation.desiredPosition);
            const targetError = Math.abs(freeLocation.relativePosition - candidate.evaluation.desiredPosition);
            if (targetError >= currentError) continue;
            actions.push(evaluate(candidate, freeLocation, fit));
          } else {
            for (const option of candidate.placementOptions?.direct ?? []) {
              if (occupiedTargetLocations.has(String(option.locationCode))) continue;
              const target = locationFromOption(option, pickZone);
              const fit = fitArticle(candidate.article, target);
              if (fit.fits && Number.isFinite(target.relativePosition)) actions.push(evaluate(candidate, target, fit));
            }
          }
        }
        const eligible = actions.filter((action) => (
          cumulativeSpanImprovement + action.spanImprovement >= -1e-12 &&
          cumulativeWeightOrderImprovement + action.weightOrderImprovement >= -1e-12 &&
          cumulativeObjectiveGain + action.objectiveGain > 1e-12
        )).toSorted((left, right) => (
          right.objectiveGain - left.objectiveGain ||
          right.affectedDocuments - left.affectedDocuments
        ));
        const best = eligible[0];
        if (!best && freeLocation) {
          freeLocation = null;
          continue;
        }
        if (!best) break;

        const candidate = best.candidate;
        const articleNumber = String(candidate.article.articleNumber);
        const weeklyQuantity = weeklyQuantityByArticle.get(articleNumber) ?? 0;
        const startsChain = freeLocation === null;
        if (startsChain) chainNumber += 1;
        best.nextOverrides.forEach((position, key) => overrides.set(key, position));
        best.nextSimulations.forEach((simulation, order) => simulations.set(order, simulation));
        usedArticles.add(articleNumber);
        occupiedTargetLocations.add(String(best.targetLocation.locationCode));
        cumulativeSpanImprovement += best.spanImprovement;
        cumulativeWeightOrderImprovement += best.weightOrderImprovement;
        cumulativeObjectiveGain += best.objectiveGain;
        steps.push({
          step: steps.length + 1,
          articleNumber,
          name: candidate.article.name ?? "UNKNOWN",
          fromLocationCode: candidate.currentLocation.locationCode,
          toLocationCode: best.targetLocation.locationCode,
          fromPosition: candidate.evaluation.currentPosition,
          toPosition: best.targetLocation.relativePosition,
          direction: candidate.evaluation.placementGap >= 0 ? "EARLIER" : "LATER",
          actionType: startsChain ? "EMPTY_LOCATION" : "REUSE_FREED_LOCATION",
          chainNumber,
          capacity: capacity(candidate.article, best.targetLocation, best.fit.estimatedCapacity, weeklyQuantity),
          spanImprovement: best.spanImprovement,
          weightOrderImprovement: best.weightOrderImprovement,
          objectiveGain: best.objectiveGain,
          affectedDocuments: best.affectedDocuments,
          cumulativeSpanImprovement,
          cumulativeWeightOrderImprovement,
          cumulativeObjectiveGain,
        });
        freeLocation = {
          locationCode: candidate.currentLocation.locationCode,
          relativePosition: candidate.evaluation.currentPosition,
          heightCm: candidate.currentLocation.heightCm,
          widthCm: candidate.currentLocation.widthCm,
          depthCm: candidate.currentLocation.depthCm,
          pickZoneType: pickZone,
        };
      }

      const signatures = new Set();
      for (const size of PACKAGE_SIZES) {
        const selected = steps.slice(0, size.maximumSteps);
        if (selected.length === 0) continue;
        const signature = selected.map((step) => step.articleNumber).join("|");
        if (signatures.has(signature)) continue;
        signatures.add(signature);
        const spanImprovement = selected.reduce((sum, step) => sum + step.spanImprovement, 0);
        const weightOrderImprovement = selected.reduce((sum, step) => sum + step.weightOrderImprovement, 0);
        const estimatedDays = selected.map((step) => step.capacity.estimatedDaysOfDemand).filter(Number.isFinite);
        const startLocationCodes = selected
          .filter((step) => step.actionType === "EMPTY_LOCATION")
          .map((step) => step.toLocationCode);
        const finalFreeLocationCodes = [...new Map(selected.map((step) => [step.chainNumber, step]))]
          .map(([, step]) => step.fromLocationCode);
        packages.push({
          id: `${encodeURIComponent(pickZone)}-${size.key}`,
          pickZone,
          size: size.key,
          sizeLabel: size.label,
          requestedSteps: size.maximumSteps,
          steps: selected,
          chainCount: startLocationCodes.length,
          startLocationCodes,
          finalFreeLocationCodes,
          startLocationCode: startLocationCodes[0],
          finalFreeLocationCode: finalFreeLocationCodes.at(-1),
          spanImprovement,
          weightOrderImprovement,
          objectiveGain: actionGain({ spanImprovement, weightOrderImprovement }),
          affectedOrderTouches: selected.reduce((sum, step) => sum + step.affectedDocuments, 0),
          minimumEstimatedDaysOfDemand: estimatedDays.length > 0 ? Math.min(...estimatedDays) : null,
          complexity: "SIMPLE_CHAIN",
        });
      }
    }

    return {
      methodology: {
        mode: "EMPTY_LOCATION_CHAIN",
        objectiveWeights: OBJECTIVE_WEIGHTS,
        guardrails: "NO_CUMULATIVE_PICK_SPAN_OR_WEIGHT_ORDER_REGRESSION",
        packageSizes: PACKAGE_SIZES,
      },
      packages: packages.toSorted((left, right) => (
        left.pickZone.localeCompare(right.pickZone, "sv") ||
        left.requestedSteps - right.requestedSteps
      )),
    };
  }
}

export { PACKAGE_SIZES };
