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
  ProjectedLayoutBuilder,
} from "../../domain/simulation/ProjectedLayoutBuilder.js";
import {
  DEFAULT_SETTINGS,
  validateSettings,
} from "../../config/DefaultSettings.js";
import { AbcXyzClassificationEngine } from "../../domain/analytics/classification/AbcXyzClassificationEngine.js";

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
import { buildShelfHeights } from "../warehouse/BuildShelfHeights.js";

import {
  resolveIdealPlacementArea,
} from "../optimization/ResolveIdealPlacementArea.js";
import { createPlacementOptionFinder } from "../optimization/PlacementOptionFinder.js";
import { PickTimeAnalysisEngine } from "./PickTimeAnalysisEngine.js";
import { RelocationBundleEngine } from "../optimization/RelocationBundleEngine.js";
import { RelocationImpactEngine } from "../optimization/RelocationImpactEngine.js";
import { RelocationPackageEngine } from "../optimization/RelocationPackageEngine.js";


export class WarehouseAnalysisService {

  static analyze({
    historyRecords,
    movementRecords = [],
    articles,
    locations,
    placementRecords,
    settings = DEFAULT_SETTINGS,
  }) {

    const activeSettings =
      validateSettings(settings);

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

    if (
      historyRecords.length === 0
    ) {
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

    let minTimestamp = Infinity;
let maxTimestamp = -Infinity;

for (const record of historyRecords) {
  const timestamp =
    record.postingDate.getTime();

  if (timestamp < minTimestamp) {
    minTimestamp = timestamp;
  }

  if (timestamp > maxTimestamp) {
    maxTimestamp = timestamp;
  }
}

const periodStart =
  new Date(minTimestamp);

const periodEnd =
  new Date(maxTimestamp);

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
        {
          movementRecords,
          locations,
        },
      );

    const positionedArticles =
      attachPickSequence(
        analyzedArticles,
        pickSequence,
      );

    const observedPickPlacements = positionedArticles
      .filter((article) => article.placementEvidence?.source === "WMS_HISTORY")
      .map((article) => ({
        article,
        location: article.positionedPickLocations[0]?.location,
        source: "WMS_HISTORY",
        observedAt: article.placementEvidence.observedAt,
      }))
      .filter((placement) => placement.location);
    const resolvedPickPlacements = [
      ...pickPlacements,
      ...observedPickPlacements,
    ];

    const shelfHeights = buildShelfHeights(
      locations,
      { beamThicknessCm: activeSettings.distance.beamThicknessCm },
    );

    const classification =
      AbcXyzClassificationEngine.analyze(
        historyRecords,
        {
          aThreshold: activeSettings.classification.abcAThreshold,
          bThreshold: activeSettings.classification.abcBThreshold,
        },
      );


    // --------------------------------------------------
    // Placement evaluation
    // --------------------------------------------------

    const placementEvaluations =
      PlacementEvaluationEngine.evaluate(
        positionedArticles,
        {
          frequencyWeight:
            activeSettings.analysis.frequencyWeight,

          handlingWeight:
            activeSettings.analysis.handlingWeight,
        },
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


    // --------------------------------------------------
    // Projected optimized layout
    // --------------------------------------------------

    const movementThreshold =
      activeSettings.analysis.movementThreshold;

    const projectedOrders =
      ProjectedLayoutBuilder.build({
        historicalOrders,

        evaluations:
          placementEvaluations,

        movementThreshold,
      });

    const optimizedSimulation =
      WarehouseSimulationEngine.simulate({
        orders:
          projectedOrders,
      });


    // --------------------------------------------------
    // Simulation comparison
    // --------------------------------------------------

    const baselineMultiPickSpan =
      baselineSimulation
        .averageMultiPickSpan;

    const optimizedMultiPickSpan =
      optimizedSimulation
        .averageMultiPickSpan;

    const pickSpanImprovement =
      baselineMultiPickSpan === 0
        ? 0
        : (
            baselineMultiPickSpan -
            optimizedMultiPickSpan
          ) /
          baselineMultiPickSpan;

    const baselineWeightOrder =
      baselineSimulation
        .weightOrderScore;

    const optimizedWeightOrder =
      optimizedSimulation
        .weightOrderScore;

    const weightOrderImprovement =
      optimizedWeightOrder -
      baselineWeightOrder;

    const simulationComparison = {
      multiPickSpan: {
        before:
          baselineMultiPickSpan,

        after:
          optimizedMultiPickSpan,

        relativeImprovement:
          pickSpanImprovement,
      },

      weightOrder: {
        before:
          baselineWeightOrder,

        after:
          optimizedWeightOrder,

        percentagePointImprovement:
          weightOrderImprovement,
      },
    };


    // --------------------------------------------------
    // Simulation coverage
    // --------------------------------------------------

    const flowSimulationCoverage =
      simulationDiagnostics.totalRecords ===
      0
        ? 0
        : simulationDiagnostics
            .includedRecords /
          simulationDiagnostics
            .totalRecords;

    const completeDocumentCoverage =
      simulationDiagnostics.totalDocuments === 0
        ? 0
        : simulationDiagnostics.fullyCoveredDocuments /
          simulationDiagnostics.totalDocuments;

    const simulatedWeightCoverage =
      simulationDiagnostics.includedRecords === 0
        ? 0
        : simulationDiagnostics.includedWeightRecords /
          simulationDiagnostics.includedRecords;


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
          Math.abs(
            b.placementGap,
          ) -
          Math.abs(
            a.placementGap,
          ),
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
        article
          .positionedPickLocations
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
        .get(
          pickZoneType,
        )
        .push(
          evaluation,
        );
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

    const pickTimeAnalysis = PickTimeAnalysisEngine.analyze({
      movementRecords,
      positionedArticles,
      evaluations: placementEvaluations,
      movementThreshold,
      pickSequence,
    });

    const observedWeekCount = classification.observedWeekCount;
    const weeklyQuantityByArticle = new Map(positionedArticles.map((article) => [
      article.articleNumber,
      observedWeekCount > 0 ? article.pickedQuantity / observedWeekCount : 0,
    ]));
    const relocationRecommendations =
      (() => {
      const findPlacementOptions = createPlacementOptionFinder({
        locations,
        placements: resolvedPickPlacements,
        pickSequence,
        weeklyQuantityByArticle,
      });

      return rankedEvaluations
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

            const currentShelfHeight = shelfHeights.get(
              currentLocation.locationCode,
            ) ?? null;

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

                  lowPreferredKg:
                    activeSettings.ergonomics.lowPreferredKg,

                  lowStronglyRecommendedKg:
                    activeSettings.ergonomics.lowStronglyRecommendedKg,
                });

            const placementOptions = Math.abs(evaluation.placementGap) >= movementThreshold
              ? findPlacementOptions({ article, currentLocation, desiredPosition: evaluation.desiredPosition })
              : null;

            return {
              evaluation,
              article,
              currentLocation,
              placementEvidence: article.placementEvidence,
              currentPhysicalPosition,
              currentShelfHeight,
              recommendedArea,
              ergonomicRecommendation,
              placementOptions,
            };
          },
        )
        .filter(
          (recommendation) =>
            recommendation !== null,
        );
      })();

    const hiddenRelocations = new Set(
      (activeSettings.articleRules ?? [])
        .filter((rule) => rule.hideRelocation)
        .map((rule) => String(rule.articleNumber)),
    );
    const impactRecommendations = relocationRecommendations.filter((recommendation) => (
      recommendation.recommendedArea !== null &&
      Math.abs(recommendation.evaluation.placementGap) >= movementThreshold &&
      !hiddenRelocations.has(String(recommendation.article.articleNumber))
    ));
    const relocationImpact = RelocationImpactEngine.analyze({
      historicalOrders,
      recommendations: impactRecommendations,
      baselineSimulation,
      optimizedSimulation,
      maximumPortfolioSize: 10,
    });
    const relocationPackages = RelocationPackageEngine.analyze({
      historicalOrders,
      recommendations: impactRecommendations,
      baselineSimulation,
      weeklyQuantityByArticle,
    });

    const relocationBundles = RelocationBundleEngine.analyze({
      movementRecords,
      positionedArticles,
      evaluations: placementEvaluations,
      movementThreshold,
      secondsPerFullSpan: pickTimeAnalysis.secondsPerFullSpan,
    });
    const bundleArticleNumbers = new Set(relocationBundles.flatMap((bundle) => bundle.articleNumbers));
    const relocationBundleSimulation = PickTimeAnalysisEngine.analyze({
      movementRecords,
      positionedArticles,
      evaluations: placementEvaluations.filter((evaluation) => bundleArticleNumbers.has(String(evaluation.articleNumber))),
      movementThreshold,
      pickSequence,
    });


    // --------------------------------------------------
    // Coverage
    // --------------------------------------------------

    const articlesWithPickLocation =
      positionedArticles.filter(
        (article) =>
          article.pickLocations.length >
          0,
      );

    const articlesWithoutPickLocation =
      positionedArticles.filter(
        (article) =>
          article.pickLocations.length ===
          0,
      );

    const articlesWithMultiplePickLocations =
      positionedArticles.filter(
        (article) =>
          article.pickLocations.length >
          1,
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

    const snapshotPlacementArticles = positionedArticles.filter((article) => (
      article.placementEvidence?.source === "PLACEMENT_SNAPSHOT"
    )).length;
    const wmsObservedPlacementArticles = positionedArticles.filter((article) => (
      article.placementEvidence?.source === "WMS_HISTORY"
    )).length;
    const unknownPlacementArticles = positionedArticles.length
      - snapshotPlacementArticles
      - wmsObservedPlacementArticles;
    const pickSequenceCodes = new Set(pickSequence.map((entry) => entry.location.locationCode));
    const movementRecordsWithKnownLocation = movementRecords.filter((record) => (
      pickSequenceCodes.has(String(record.sourceLocation))
    )).length;
    const articleByNumber = new Map(articles.map((article) => [String(article.articleNumber), article]));
    const historyRecordsWithValidWeight = historyRecords.filter((record) => {
      const article = articleByNumber.get(String(record.articleNumber));
      return article && Number.isFinite(article.weightKg) && article.weightKg >= 0;
    }).length;

    const dataCoverage = {
      placement: {
        analyzedArticles: positionedArticles.length,
        snapshotArticles: snapshotPlacementArticles,
        wmsObservedArticles: wmsObservedPlacementArticles,
        resolvedArticles: snapshotPlacementArticles + wmsObservedPlacementArticles,
        unknownArticles: unknownPlacementArticles,
        snapshotCoverage: positionedArticles.length > 0
          ? snapshotPlacementArticles / positionedArticles.length
          : 0,
        resolvedCoverage: positionedArticles.length > 0
          ? (snapshotPlacementArticles + wmsObservedPlacementArticles) / positionedArticles.length
          : 0,
      },
      movementLocation: {
        records: movementRecords.length,
        resolvedRecords: movementRecordsWithKnownLocation,
        coverage: movementRecords.length > 0
          ? movementRecordsWithKnownLocation / movementRecords.length
          : 0,
      },
      weight: {
        records: historyRecords.length,
        validRecords: historyRecordsWithValidWeight,
        coverage: historyRecords.length > 0
          ? historyRecordsWithValidWeight / historyRecords.length
          : 0,
      },
      flow: {
        records: simulationDiagnostics.totalRecords,
        includedRecords: simulationDiagnostics.includedRecords,
        coverage: flowSimulationCoverage,
        documents: simulationDiagnostics.totalDocuments,
        completeDocuments: simulationDiagnostics.fullyCoveredDocuments,
        completeDocumentCoverage,
      },
      simulatedWeight: {
        records: simulationDiagnostics.includedRecords,
        validRecords: simulationDiagnostics.includedWeightRecords,
        coverage: simulatedWeightCoverage,
      },
      relocation: {
        analyzedArticles: positionedArticles.length,
        eligibleArticles: placementEvaluations.length,
        coverage: positionedArticles.length > 0
          ? placementEvaluations.length / positionedArticles.length
          : 0,
      },
    };


    // --------------------------------------------------
    // Result
    // --------------------------------------------------

    return {
      period: {
        start:
          periodStart,

        end:
          periodEnd,
      },

      warehouse: {
        pickSequence,
        bayFlow,
        physicalZoneSequence,
        shelfHeights,
      },

      placements: {
        result:
          placementResult,

        pickPlacements,
        observedPickPlacements,
        resolvedPickPlacements,
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

        classification,
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

      relocationBundles,

      relocationImpact,

      relocationPackages,

      relocationBundleSimulation,

      dataCoverage,

      simulation: {
        historicalOrders,
        pickTime: pickTimeAnalysis,

        projectedOrders,

        baseline:
          baselineSimulation,

        optimized:
          optimizedSimulation,

        comparison:
          simulationComparison,

        movementThreshold,

        coverage:
          flowSimulationCoverage,

        coverageDetails: {
          flow: flowSimulationCoverage,
          completeDocuments: completeDocumentCoverage,
          weight: simulatedWeightCoverage,
          relocation: positionedArticles.length > 0
            ? placementEvaluations.length / positionedArticles.length
            : 0,
        },

        diagnostics:
          simulationDiagnostics,
      },
    };
  }
}
