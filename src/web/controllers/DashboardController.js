import {
  WarehouseDataLoader,
} from "../../infrastructure/data/WarehouseDataLoader.js";

import {
  WarehouseAnalysisService,
} from "../../application/analysis/WarehouseAnalysisService.js";

import {
  DataFiles,
} from "../../config/DataFiles.js";
import {
  buildRelocationViewModel,
} from "../viewmodels/buildRelocationViewModel.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";


export class DashboardController {

  static async index(req, res, next) {
    try {
      const data =
        await WarehouseDataLoader.load({
          historyPath:
            DataFiles.history,

          articlePath:
            DataFiles.articles,

          locationPath:
            DataFiles.locations,

          placementPath:
            DataFiles.placements,
        });

      const settings =
        await SettingsRepository.load();


      const analysis =
        WarehouseAnalysisService.analyze({
          historyRecords:
            data.historyRecords,

          articles:
            data.articles,

          locations:
            data.locations,

          placementRecords:
            data.placementRecords,

          settings,
        });


      // --------------------------------------------------
      // Recommendations
      // --------------------------------------------------

      const relocationCandidates =
        buildRelocationViewModel(analysis);


      // --------------------------------------------------
      // Dashboard thresholds
      // --------------------------------------------------

      const strongGapThreshold =
        analysis.simulation.movementThreshold;


      const lowPlacementRecommendations =
        relocationCandidates.filter(
          (recommendation) =>
            recommendation
              .ergonomicRecommendation ===
              "LOW_PREFERRED" ||

            recommendation
              .ergonomicRecommendation ===
              "LOW_STRONGLY_RECOMMENDED",
        );


      // --------------------------------------------------
      // Pick zone distribution
      // --------------------------------------------------

      const pickZoneDistribution =
        new Map();


      for (
        const entry
        of analysis.warehouse
          .pickSequence
      ) {
        const pickZone =
          entry.pickZoneType;


        pickZoneDistribution.set(
          pickZone,

          (
            pickZoneDistribution.get(
              pickZone,
            ) ?? 0
          ) + 1,
        );
      }


      const totalPickLocations =
        analysis.warehouse
          .pickSequence.length;


      const pickZones = [
        ...pickZoneDistribution,
      ].map(
        ([name, count]) => ({
          name,

          count,

          percentage:
            totalPickLocations > 0
              ? count /
                totalPickLocations
              : 0,
        }),
      );


      // --------------------------------------------------
      // Simulation
      // --------------------------------------------------

      const simulation =
        analysis.simulation;


      const simulationBaseline =
        simulation?.baseline;


      const simulationOptimized =
        simulation?.optimized;


      const simulationComparison =
        simulation?.comparison;


      const simulationDiagnostics =
        simulation?.diagnostics;


      const simulationSummary = {
        available:
          Boolean(
            simulationBaseline &&
            simulationOptimized &&
            simulationComparison &&
            simulationDiagnostics,
          ),


        // ----------------------------------------------
        // Coverage
        // ----------------------------------------------

        snapshotCoverage:
          simulation?.coverage ?? 0,

        historicalRecords:
          simulationDiagnostics
            ?.totalRecords ?? 0,

        individuallyValidRecords:
          simulationDiagnostics
            ?.validRecords ?? 0,

        includedRecords:
          simulationDiagnostics
            ?.includedRecords ?? 0,

        excludedRecords:
          simulationDiagnostics
            ?.excludedRecords ?? 0,

        recordsExcludedByDocumentFilter:
          simulationDiagnostics
            ?.recordsExcludedByDocumentFilter ??
          0,


        // ----------------------------------------------
        // Historical documents
        // ----------------------------------------------

        totalDocuments:
          simulationDiagnostics
            ?.totalDocuments ?? 0,

        fullyCoveredDocuments:
          simulationDiagnostics
            ?.fullyCoveredDocuments ?? 0,

        partiallyCoveredDocuments:
          simulationDiagnostics
            ?.partiallyCoveredDocuments ??
          0,

        uncoveredDocuments:
          simulationDiagnostics
            ?.uncoveredDocuments ?? 0,


        // ----------------------------------------------
        // Simulation population
        // ----------------------------------------------

        simulationGroups:
          simulationBaseline
            ?.simulatedOrders ?? 0,

        simulatedPicks:
          simulationBaseline
            ?.totalPicks ?? 0,

        singlePickGroups:
          simulationBaseline
            ?.singlePickGroups ?? 0,

        multiPickGroups:
          simulationBaseline
            ?.multiPickGroups ?? 0,


        // ----------------------------------------------
        // Current layout
        // ----------------------------------------------

        baseline: {
          averagePickSpan:
            simulationBaseline
              ?.averagePickSpan ?? 0,

          averageMultiPickSpan:
            simulationBaseline
              ?.averageMultiPickSpan ?? 0,

          weightOrderScore:
            simulationBaseline
              ?.weightOrderScore ?? 0,

          correctlyOrderedPairs:
            simulationBaseline
              ?.correctlyOrderedPairs ?? 0,

          comparablePairs:
            simulationBaseline
              ?.comparablePairs ?? 0,
        },


        // ----------------------------------------------
        // Optimized layout
        // ----------------------------------------------

        optimized: {
          averagePickSpan:
            simulationOptimized
              ?.averagePickSpan ?? 0,

          averageMultiPickSpan:
            simulationOptimized
              ?.averageMultiPickSpan ?? 0,

          weightOrderScore:
            simulationOptimized
              ?.weightOrderScore ?? 0,

          correctlyOrderedPairs:
            simulationOptimized
              ?.correctlyOrderedPairs ?? 0,

          comparablePairs:
            simulationOptimized
              ?.comparablePairs ?? 0,
        },


        // ----------------------------------------------
        // Improvement
        // ----------------------------------------------

        comparison: {
          multiPickSpan: {
            before:
              simulationComparison
                ?.multiPickSpan
                ?.before ?? 0,

            after:
              simulationComparison
                ?.multiPickSpan
                ?.after ?? 0,

            relativeImprovement:
              simulationComparison
                ?.multiPickSpan
                ?.relativeImprovement ??
              0,
          },

          weightOrder: {
            before:
              simulationComparison
                ?.weightOrder
                ?.before ?? 0,

            after:
              simulationComparison
                ?.weightOrder
                ?.after ?? 0,

            percentagePointImprovement:
              simulationComparison
                ?.weightOrder
                ?.percentagePointImprovement ??
              0,
          },
        },


        // ----------------------------------------------
        // Diagnostics
        // ----------------------------------------------

        invalidWeight:
          simulationDiagnostics
            ?.invalidWeight ?? 0,

        noPickLocation:
          simulationDiagnostics
            ?.noPickLocation ?? 0,

        multiplePickLocations:
          simulationDiagnostics
            ?.multiplePickLocations ?? 0,


        // ----------------------------------------------
        // Configuration
        // ----------------------------------------------

        movementThreshold:
          simulation
            ?.movementThreshold ??
          strongGapThreshold,
      };


      // --------------------------------------------------
      // Calendar
      // --------------------------------------------------

      const calendar =
        buildCalendar({
          historyRecords:
            data.historyRecords,

          periodEnd:
            analysis.period.end,
        });


      // --------------------------------------------------
      // Render
      // --------------------------------------------------

      res.render(
        "dashboard",
        {
          title:
            "TrendTornado",

          period: {
            start:
              analysis.period.start,

            end:
              analysis.period.end,
          },

          summary: {
            analyzedArticles:
              analysis.articles
                .positioned.length,

            evaluatedArticles:
              analysis.evaluations
                .all.length,

            relocationCandidates:
              relocationCandidates.length,

            lowPlacementRecommendations:
              lowPlacementRecommendations
                .length,
          },

          simulation:
            simulationSummary,

          calendar,

          importSummary:
            data.importSummary,

          recommendations:
            relocationCandidates,

          pickZones,

          strongGapThreshold,
        },
      );

    } catch (error) {
      next(error);
    }
  }
}


// ==================================================
// Calendar view model
// ==================================================

function buildCalendar({
  historyRecords,
  periodEnd,
}) {
  const year =
    periodEnd.getFullYear();

  const month =
    periodEnd.getMonth();


  const recordsPerDate =
    new Map();


  for (
    const record
    of historyRecords
  ) {
    const key =
      toDateKey(
        record.postingDate,
      );


    recordsPerDate.set(
      key,

      (
        recordsPerDate.get(
          key,
        ) ?? 0
      ) + 1,
    );
  }


  const firstDay =
    new Date(
      year,
      month,
      1,
    );


  const mondayOffset =
    (
      firstDay.getDay() + 6
    ) % 7;


  const calendarStart =
    new Date(
      year,
      month,
      1 - mondayOffset,
    );


  const days = [];


  for (
    let index = 0;
    index < 42;
    index++
  ) {
    const date =
      new Date(
        calendarStart,
      );


    date.setDate(
      calendarStart.getDate() +
      index,
    );


    const key =
      toDateKey(
        date,
      );


    days.push({
      date,

      day:
        date.getDate(),

      outside:
        date.getMonth() !==
        month,

      recordCount:
        recordsPerDate.get(
          key,
        ) ?? 0,

      hasData:
        recordsPerDate.has(
          key,
        ),
    });
  }


  const monthLabel =
    new Intl.DateTimeFormat(
      "sv-SE",
      {
        month:
          "long",

        year:
          "numeric",
      },
    ).format(
      firstDay,
    );


  return {
    monthLabel:
      capitalizeFirst(
        monthLabel,
      ),

    days,
  };
}


function toDateKey(
  date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );


  return (
    `${year}-${month}-${day}`
  );
}


function capitalizeFirst(
  value,
) {
  if (!value) {
    return value;
  }


  return (
    value.charAt(0)
      .toUpperCase() +
    value.slice(1)
  );
}
