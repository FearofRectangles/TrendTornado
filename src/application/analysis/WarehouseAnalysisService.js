import {
  StatisticsEngine,
} from "../../domain/analytics/statistics/StatisticsEngine.js";

import {
  PlacementEvaluationEngine,
} from "../../domain/analytics/placement/PlacementEvaluationEngine.js";

import {
  PlacementDiagnostics,
} from "../../domain/analytics/placement/PlacementDiagnostics.js";

import {
  ErgonomicRecommendationEngine,
} from "../../domain/analytics/placement/ErgonomicRecommendationEngine.js";

import {
  LocationPurpose,
} from "../../domain/shared/LocationPurpose.js";

import {
  HistoricalOrderBuilder,
} from "../../domain/simulation/HistoricalOrderBuilder.js";

import {
  WarehouseSimulationEngine,
} from "../../domain/simulation/WarehouseSimulationEngine.js";

import {
  enrichArticleStatistics,
} from "./EnrichArticleStatistics.js";

import {
  attachPickPlacements,
} from "./AttachPickPlacements.js";

import {
  attachPickSequence,
} from "./AttachPickSequence.js";

import {
  buildPlacements,
} from "../warehouse/BuildPlacements.js";

import {
  buildPickSequence,
} from "../warehouse/BuildPickSequence.js";

import {
  buildPhysicalZoneSequence,
} from "../warehouse/BuildPhysicalZoneSequence.js";

import {
  buildBayFlow,
} from "../warehouse/BuildBayFlow.js";

import {
  resolveIdealPlacementArea,
} from "../optimization/ResolveIdealPlacementArea.js";


export class WarehouseAnalysisService {

  static analyze({
    historyRecords,
    articles,
    locations,
    placementRecords,
  }) {

    if (
      !Array.isArray(historyRecords) ||
      !Array.isArray(articles) ||
      !Array.isArray(locations) ||
      !Array.isArray(placementRecords)
    ) {
      throw new TypeError(
        "Warehouse analysis input must contain arrays.",
      );
    }

    if (historyRecords.length === 0) {
      throw new Error(
        "No valid pick history records found.",
      );
    }


    // --------------------------------------------------
    // Placements
    // --------------------------------------------------

    const placementResult =
      buildPlacements(
        placementRecords,
        articles,
        locations,
      );

    const pickPlacements =
      placementResult.placements.filter(
        (placement) =>
          placement.location.purpose ===
          LocationPurpose.PICK,
      );


    // --------------------------------------------------
    // Warehouse structure
    // --------------------------------------------------

    const pickSequence =
      buildPickSequence(
        locations,
      );

    const bayFlow =
      buildBayFlow(
        locations,
      );

    const physicalZoneSequence =
      buildPhysicalZoneSequence(
        locations,
      );

    const physicalZoneByLocationCode =
      new Map(
        physicalZoneSequence.map(
          (entry) => [
            entry.location.locationCode,
            entry,
          ],
        ),
      );


    // --------------------------------------------------
    // Analysis period
    // --------------------------------------------------

    const timestamps =
      historyRecords.map(
        (record) =>
          record.postingDate.getTime(),
      );

    const periodStart =
      new Date(
        Math.min(...timestamps),
      );

    const periodEnd =
      new Date(
        Math.max(...timestamps),
      );

    periodStart.setHours(
      0,
      0,
      0,
      0,
    );

    periodEnd.setHours(
      23,
      59,
      59,
      999,
    );


    // --------------------------------------------------
    // Statistics
    // --------------------------------------------------

    const statistics =
      StatisticsEngine.calculate(
        historyRecords,
        {
          periodStart,
          periodEnd,
        },
      );

    const enrichedStatistics =
      enrichArticleStatistics(
        statistics,
        articles,
      );

    const analyzedArticles =
      attachPickPlacements(
        enrichedStatistics,
        pickPlacements,
      );

    const positionedArticles =
      attachPickSequence(
        analyzedArticles,
        pickSequence,
      );


    // --------------------------------------------------
    // Historical simulation / current layout baseline
    // --------------------------------------------------

const historicalBuildResult =
  HistoricalOrderBuilder
    .buildWithDiagnostics({
      historyRecords,

      articles:
        positionedArticles,
    });


const historicalOrders =
  historicalBuildResult.orders;


const simulationDiagnostics =
  historicalBuildResult.diagnostics;


const baselineSimulation =
  WarehouseSimulationEngine.simulate({
    orders:
      historicalOrders,
  });


const simulationCoverage =
  simulationDiagnostics.totalRecords === 0
    ? 0
    : simulationDiagnostics.includedRecords /
      simulationDiagnostics.totalRecords;


    // --------------------------------------------------
    // Placement evaluation
    // --------------------------------------------------

    const placementEvaluations =
      PlacementEvaluationEngine.evaluate(
        positionedArticles,
        {
          frequencyWeight: 0.7,
          handlingWeight: 0.3,
        },
      );


    // --------------------------------------------------
    // Lookups
    // --------------------------------------------------

    const articlesByNumber =
      new Map(
        positionedArticles.map(
          (article) => [
            article.articleNumber,
            article,
          ],
        ),
      );


    // --------------------------------------------------
    // Rankings
    // --------------------------------------------------

    const rankedArticles =
      positionedArticles.toSorted(
        (a, b) =>
          b.pickFrequency -
          a.pickFrequency,
      );

    const rankedEvaluations =
      placementEvaluations.toSorted(
        (a, b) =>
          b.placementGap -
          a.placementGap,
      );


    // --------------------------------------------------
    // Diagnostics
    // --------------------------------------------------

    const evaluationsByPickZone =
      new Map();

    for (
      const evaluation
      of placementEvaluations
    ) {
      const article =
        articlesByNumber.get(
          evaluation.articleNumber,
        );

      if (
        !article ||
        article.positionedPickLocations
          .length === 0
      ) {
        continue;
      }

      const pickZoneType =
        article
          .positionedPickLocations[0]
          .location
          .pickZoneType;

      if (
        !evaluationsByPickZone.has(
          pickZoneType,
        )
      ) {
        evaluationsByPickZone.set(
          pickZoneType,
          [],
        );
      }

      evaluationsByPickZone
        .get(pickZoneType)
        .push(evaluation);
    }

    const placementDiagnostics =
      new Map(
        [
          ...evaluationsByPickZone,
        ].map(
          ([
            pickZoneType,
            evaluations,
          ]) => [
            pickZoneType,

            PlacementDiagnostics.analyze(
              evaluations,
            ),
          ],
        ),
      );


    // --------------------------------------------------
    // Relocation recommendations
    // --------------------------------------------------

    const relocationRecommendations =
      rankedEvaluations
        .map(
          (evaluation) => {

            const article =
              articlesByNumber.get(
                evaluation.articleNumber,
              );

            if (
              !article ||
              article
                .positionedPickLocations
                .length === 0
            ) {
              return null;
            }

            const positioned =
              article
                .positionedPickLocations[0];

            const currentLocation =
              positioned.location;

            const currentPhysicalPosition =
              physicalZoneByLocationCode.get(
                currentLocation.locationCode,
              );

            const recommendedArea =
              resolveIdealPlacementArea({
                desiredPosition:
                  evaluation.desiredPosition,

                pickZoneType:
                  currentLocation.pickZoneType,

                bayFlow,
              });

            const ergonomicRecommendation =
              ErgonomicRecommendationEngine
                .evaluate({
                  weightKg:
                    article.weightKg,

                  averageHandledWeightPerPick:
                    evaluation
                      .averageHandledWeightPerPick,
                });

            return {
              evaluation,
              article,
              currentLocation,
              currentPhysicalPosition,
              recommendedArea,
              ergonomicRecommendation,
            };
          },
        )
        .filter(
          (recommendation) =>
            recommendation !== null,
        );


    // --------------------------------------------------
    // Coverage
    // --------------------------------------------------

    const articlesWithPickLocation =
      positionedArticles.filter(
        (article) =>
          article.pickLocations.length > 0,
      );

    const articlesWithoutPickLocation =
      positionedArticles.filter(
        (article) =>
          article.pickLocations.length === 0,
      );

    const articlesWithMultiplePickLocations =
      positionedArticles.filter(
        (article) =>
          article.pickLocations.length > 1,
      );

    const articlesWithPosition =
      positionedArticles.filter(
        (article) =>
          article
            .positionedPickLocations
            .some(
              (positioned) =>
                positioned
                  .relativePickPosition !==
                null,
            ),
      );


    // --------------------------------------------------
    // Result
    // --------------------------------------------------

    return {
      period: {
        start: periodStart,
        end: periodEnd,
      },

      warehouse: {
        pickSequence,
        bayFlow,
        physicalZoneSequence,
      },

      placements: {
        result: placementResult,
        pickPlacements,
      },

      articles: {
        positioned:
          positionedArticles,

        ranked:
          rankedArticles,

        withPickLocation:
          articlesWithPickLocation,

        withoutPickLocation:
          articlesWithoutPickLocation,

        withMultiplePickLocations:
          articlesWithMultiplePickLocations,

        withPosition:
          articlesWithPosition,
      },

      evaluations: {
        all:
          placementEvaluations,

        ranked:
          rankedEvaluations,

        diagnostics:
          placementDiagnostics,
      },

      recommendations:
        relocationRecommendations,

      simulation: {
        historicalOrders,

        baseline:
          baselineSimulation,

        coverage:
          simulationCoverage,

        diagnostics:
          simulationDiagnostics,
},
    };
  }
}