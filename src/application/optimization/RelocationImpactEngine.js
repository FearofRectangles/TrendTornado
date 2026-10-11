import { OrderSimulationEngine } from "../../domain/simulation/OrderSimulationEngine.js";

const OBJECTIVE_WEIGHTS = Object.freeze({
  pickSpan: 0.7,
  weightOrder: 0.3,
});

function simulateOrder(order, overrides = new Map()) {
  return OrderSimulationEngine.simulate({
    documentNumber: order.documentNumber,
    picks: order.picks.map((pick) => ({
      ...pick,
      relativePosition: overrides.get(String(pick.articleNumber)) ?? pick.relativePosition,
    })),
  });
}

function objectiveGain({ spanImprovement, weightOrderImprovement }) {
  return (
    OBJECTIVE_WEIGHTS.pickSpan * spanImprovement +
    OBJECTIVE_WEIGHTS.weightOrder * weightOrderImprovement
  );
}

function passesPortfolioGuardrails(impact) {
  const tolerance = 1e-12;
  return (
    impact.spanImprovement >= -tolerance &&
    impact.weightOrderImprovement >= -tolerance &&
    impact.objectiveGain > tolerance
  );
}

function buildAction(recommendation) {
  const evaluation = recommendation.evaluation;
  const articleNumber = String(evaluation?.articleNumber ?? recommendation.article?.articleNumber ?? "");
  if (!articleNumber || !Number.isFinite(evaluation?.desiredPosition)) return null;

  const options = recommendation.placementOptions;
  const direct = options?.direct?.[0] ?? null;
  const adjustment = options?.adjustments?.[0] ?? null;
  const swap = options?.swaps?.[0] ?? null;
  const selected = direct ?? adjustment ?? swap;
  const actionType = direct
    ? "DIRECT"
    : adjustment
      ? "BEAM_ADJUSTMENT"
      : swap
        ? "SWAP"
        : "THEORETICAL";
  const targetPosition = Number.isFinite(selected?.relativePosition)
    ? selected.relativePosition
    : evaluation.desiredPosition;
  const moves = new Map([[articleNumber, targetPosition]]);
  const articleNumbers = [articleNumber];
  const destinationLocationCodes = selected?.locationCode ? [String(selected.locationCode)] : [];

  if (actionType === "SWAP") {
    const displacedArticleNumber = String(selected.displacedArticle?.articleNumber ?? "");
    if (displacedArticleNumber && Number.isFinite(evaluation.currentPosition)) {
      moves.set(displacedArticleNumber, evaluation.currentPosition);
      articleNumbers.push(displacedArticleNumber);
      if (recommendation.currentLocation?.locationCode) {
        destinationLocationCodes.push(String(recommendation.currentLocation.locationCode));
      }
    }
  }

  return {
    id: `${actionType}:${articleNumbers.join(":")}:${selected?.locationCode ?? "TARGET"}`,
    articleNumber,
    articleNumbers,
    moves,
    actionType,
    operational: actionType !== "THEORETICAL",
    unverifiedReason: actionType === "THEORETICAL"
      ? options?.dataQuality === "UNKNOWN"
        ? "MISSING_ARTICLE_DIMENSIONS"
        : "NO_FEASIBLE_LOCATION"
      : null,
    targetPosition,
    targetLocationCode: selected?.locationCode ?? null,
    destinationLocationCodes,
    capacity: selected?.capacity ?? null,
    adjustmentCm: selected?.adjustmentCm ?? null,
    displacedArticle: selected?.displacedArticle ?? null,
    currentPosition: evaluation.currentPosition,
    placementGap: evaluation.placementGap,
  };
}

export class RelocationImpactEngine {
  static analyze({
    historicalOrders,
    recommendations,
    baselineSimulation,
    optimizedSimulation,
    maximumPortfolioSize = 10,
  }) {
    if (!Array.isArray(historicalOrders) || !Array.isArray(recommendations)) {
      throw new TypeError("Historical orders and recommendations must be arrays.");
    }

    const multiPickGroups = baselineSimulation?.multiPickGroups ?? 0;
    const comparablePairs = baselineSimulation?.comparablePairs ?? 0;
    const groupsByArticle = new Map();
    const baselineByOrder = new Map();

    historicalOrders.forEach((order) => {
      baselineByOrder.set(order, simulateOrder(order));
      for (const articleNumber of new Set(order.picks.map((pick) => String(pick.articleNumber)))) {
        if (!groupsByArticle.has(articleNumber)) groupsByArticle.set(articleNumber, []);
        groupsByArticle.get(articleNumber).push(order);
      }
    });

    const candidates = recommendations.map(buildAction).filter(Boolean);

    const evaluateCandidate = ({ candidate, overrides, simulationsByOrder }) => {
      let spanDelta = 0;
      let correctPairDelta = 0;
      let improvedGroups = 0;
      let worsenedGroups = 0;
      const nextSimulations = new Map();
      const nextOverrides = new Map(overrides);
      candidate.moves.forEach((position, articleNumber) => nextOverrides.set(articleNumber, position));
      const affectedOrders = new Set();
      candidate.articleNumbers.forEach((articleNumber) => {
        (groupsByArticle.get(articleNumber) ?? []).forEach((order) => affectedOrders.add(order));
      });
      const affectedDocuments = new Set();

      for (const order of affectedOrders) {
        const before = simulationsByOrder.get(order) ?? baselineByOrder.get(order);
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
        articleNumber: candidate.articleNumber,
        articleNumbers: candidate.articleNumbers,
        actionType: candidate.actionType,
        operational: candidate.operational,
        unverifiedReason: candidate.unverifiedReason,
        targetLocationCode: candidate.targetLocationCode,
        destinationLocationCodes: candidate.destinationLocationCodes,
        capacity: candidate.capacity,
        adjustmentCm: candidate.adjustmentCm,
        displacedArticle: candidate.displacedArticle,
        currentPosition: candidate.currentPosition,
        targetPosition: candidate.targetPosition,
        placementGap: candidate.placementGap,
        affectedGroups: affectedOrders.size,
        affectedDocuments: affectedDocuments.size,
        improvedGroups,
        worsenedGroups,
        spanImprovement,
        weightOrderImprovement,
        objectiveGain: objectiveGain({ spanImprovement, weightOrderImprovement }),
        moves: candidate.moves,
        nextOverrides,
        nextSimulations,
      };
    };

    const emptyOverrides = new Map();
    const individualImpacts = candidates.map((candidate) => evaluateCandidate({
      candidate,
      overrides: emptyOverrides,
      simulationsByOrder: baselineByOrder,
    })).toSorted((left, right) => (
      right.objectiveGain - left.objectiveGain ||
      right.affectedDocuments - left.affectedDocuments
    ));

    const totalSpanPotential = Math.max(
      0,
      (baselineSimulation?.averageMultiPickSpan ?? 0) -
      (optimizedSimulation?.averageMultiPickSpan ?? 0),
    );
    const totalWeightPotential = Math.max(
      0,
      (optimizedSimulation?.weightOrderScore ?? 0) -
      (baselineSimulation?.weightOrderScore ?? 0),
    );
    const totalObjectivePotential = objectiveGain({
      spanImprovement: totalSpanPotential,
      weightOrderImprovement: totalWeightPotential,
    });

    const selectPortfolio = (portfolioCandidates, basis) => {
      const selected = [];
      const remaining = new Map(portfolioCandidates.map((candidate) => [candidate.id, candidate]));
      const activeOverrides = new Map();
      const activeSimulations = new Map(baselineByOrder);
      const usedArticles = new Set();
      const reservedDestinations = new Set();
      let cumulativeSpanImprovement = 0;
      let cumulativeWeightOrderImprovement = 0;
      let cumulativeObjectiveGain = 0;

      while (selected.length < maximumPortfolioSize && remaining.size > 0) {
        let best = null;
        for (const candidate of remaining.values()) {
          if (
            candidate.articleNumbers.some((articleNumber) => usedArticles.has(articleNumber)) ||
            candidate.destinationLocationCodes.some((locationCode) => reservedDestinations.has(locationCode))
          ) continue;
          const impact = evaluateCandidate({
            candidate,
            overrides: activeOverrides,
            simulationsByOrder: activeSimulations,
          });
          if (
            passesPortfolioGuardrails(impact) &&
            (!best || impact.objectiveGain > best.objectiveGain)
          ) best = impact;
        }

        if (!best) break;

        best.moves.forEach((position, articleNumber) => activeOverrides.set(articleNumber, position));
        best.nextSimulations.forEach((simulation, order) => activeSimulations.set(order, simulation));
        best.articleNumbers.forEach((articleNumber) => usedArticles.add(articleNumber));
        best.destinationLocationCodes.forEach((locationCode) => reservedDestinations.add(locationCode));
        for (const [id, candidate] of remaining) {
          if (
            candidate.articleNumbers.some((articleNumber) => usedArticles.has(articleNumber)) ||
            candidate.destinationLocationCodes.some((locationCode) => reservedDestinations.has(locationCode))
          ) remaining.delete(id);
        }
        cumulativeSpanImprovement += best.spanImprovement;
        cumulativeWeightOrderImprovement += best.weightOrderImprovement;
        cumulativeObjectiveGain += best.objectiveGain;
        selected.push({
          rank: selected.length + 1,
          ...best,
          cumulativeSpanImprovement,
          cumulativeWeightOrderImprovement,
          cumulativeObjectiveGain,
        });
      }

      return {
        basis,
        items: selected.map(({ moves, nextOverrides, nextSimulations, ...item }) => item),
        baseline: {
          averageMultiPickSpan: baselineSimulation?.averageMultiPickSpan ?? 0,
          weightOrderScore: baselineSimulation?.weightOrderScore ?? 0,
        },
        simulatedAfter: {
          averageMultiPickSpan: Math.max(0, (baselineSimulation?.averageMultiPickSpan ?? 0) - cumulativeSpanImprovement),
          weightOrderScore: Math.max(0, Math.min(1, (baselineSimulation?.weightOrderScore ?? 0) + cumulativeWeightOrderImprovement)),
        },
        totalObjectivePotential,
        realizedPotentialShare: totalObjectivePotential > 0
          ? cumulativeObjectiveGain / totalObjectivePotential
          : 0,
      };
    };

    const operationalCandidates = candidates.filter((candidate) => candidate.operational);
    const theoreticalCandidates = candidates.filter((candidate) => !candidate.operational);
    const missingDimensionCandidates = theoreticalCandidates.filter((candidate) => (
      candidate.unverifiedReason === "MISSING_ARTICLE_DIMENSIONS"
    )).length;
    const noFeasibleLocationCandidates = theoreticalCandidates.length - missingDimensionCandidates;
    const operationalPortfolio = selectPortfolio(operationalCandidates, "PHYSICALLY_VERIFIED");
    const analyticalPortfolio = selectPortfolio(candidates, "MIXED_WITH_THEORETICAL_FALLBACK");

    return {
      methodology: {
        mode: "SHADOW",
        target: "BEST_GEOMETRIC_OPTION_WITH_THEORETICAL_FALLBACK",
        objectiveWeights: OBJECTIVE_WEIGHTS,
        guardrails: "NO_PICK_SPAN_OR_WEIGHT_ORDER_REGRESSION",
        portfolioEligibility: "DIRECT_SWAP_OR_BEAM_ADJUSTMENT_ONLY",
      },
      individualImpacts: individualImpacts.map(({ moves, nextOverrides, nextSimulations, ...impact }) => impact),
      portfolio: {
        ...operationalPortfolio,
        operationalCandidateCount: operationalCandidates.length,
        theoreticalCandidateCount: theoreticalCandidates.length,
        missingDimensionCandidateCount: missingDimensionCandidates,
        noFeasibleLocationCandidateCount: noFeasibleLocationCandidates,
      },
      analyticalPortfolio: {
        ...analyticalPortfolio,
        operationalCandidateCount: operationalCandidates.length,
        theoreticalCandidateCount: theoreticalCandidates.length,
        missingDimensionCandidateCount: missingDimensionCandidates,
        noFeasibleLocationCandidateCount: noFeasibleLocationCandidates,
      },
    };
  }
}

export { OBJECTIVE_WEIGHTS };
