import {
  WarehouseDataLoader,
} from "../../infrastructure/data/WarehouseDataLoader.js";

import {
  WarehouseAnalysisService,
} from "../../application/analysis/WarehouseAnalysisService.js";

import {
  DataFiles,
} from "../../config/DataFiles.js";


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
        });


      // --------------------------------------------------
      // Recommendations
      // --------------------------------------------------

      const recommendations =
        analysis.recommendations

          .filter(
            (recommendation) =>
              recommendation
                .recommendedArea !== null,
          )

          .map(
            (recommendation) => {
              const {
                evaluation,
                article,
                currentLocation,
                currentPhysicalPosition,
                recommendedArea,
                ergonomicRecommendation,
              } = recommendation;


              return {
                articleNumber:
                  article.articleNumber,

                name:
                  article.name ??
                  "UNKNOWN",

                pickZone:
                  currentLocation
                    .pickZoneType,

                currentLocation:
                  currentLocation
                    .locationCode,

                currentZone:
                  currentLocation.zone,

                currentSection:
                  currentPhysicalPosition
                    ?.zoneSection ??
                  "UNKNOWN",

                currentPosition:
                  evaluation
                    .currentPosition,

                recommendedZone:
                  recommendedArea.zone,

                recommendedSection:
                  recommendedArea.section,

                desiredPosition:
                  evaluation
                    .desiredPosition,

                placementGap:
                  evaluation
                    .placementGap,

                direction:
                  evaluation.placementGap >= 0
                    ? "EARLIER"
                    : "LATER",

                ergonomicRecommendation:
                  ergonomicRecommendation
                    .recommendation,

                averageHandledWeightPerPick:
                  evaluation
                    .averageHandledWeightPerPick,

                status:
                  "NEW",
              };
            },
          );


      // --------------------------------------------------
      // Dashboard thresholds
      // --------------------------------------------------

      const strongGapThreshold =
        0.20;


      const relocationCandidates =
        recommendations

          .filter(
            (recommendation) =>
              Math.abs(
                recommendation
                  .placementGap,
              ) >= strongGapThreshold,
          )

          .toSorted(
            (a, b) =>
              Math.abs(
                b.placementGap,
              ) -
              Math.abs(
                a.placementGap,
              ),
          );


      const lowPlacementRecommendations =
        recommendations.filter(
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
        of analysis.warehouse.pickSequence
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
      // Historical simulation
      // --------------------------------------------------

      const simulation =
        analysis.simulation;


      const simulationBaseline =
        simulation?.baseline;


      const simulationDiagnostics =
        simulation?.diagnostics;


      const simulationSummary = {
        available:
          Boolean(
            simulationBaseline &&
            simulationDiagnostics,
          ),

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

        simulationGroups:
          simulationDiagnostics
            ?.simulatedGroups ?? 0,

        simulatedPicks:
          simulationBaseline
            ?.totalPicks ?? 0,

        singlePickGroups:
          simulationBaseline
            ?.singlePickGroups ?? 0,

        multiPickGroups:
          simulationBaseline
            ?.multiPickGroups ?? 0,

        averageMultiPickSpan:
          simulationBaseline
            ?.averageMultiPickSpan ?? 0,

        averagePickSpan:
          simulationBaseline
            ?.averagePickSpan ?? 0,

        weightOrderScore:
          simulationBaseline
            ?.weightOrderScore ?? 0,

        correctlyOrderedPairs:
          simulationBaseline
            ?.correctlyOrderedPairs ?? 0,

        comparablePairs:
          simulationBaseline
            ?.comparablePairs ?? 0,

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

        invalidWeight:
          simulationDiagnostics
            ?.invalidWeight ?? 0,

        noPickLocation:
          simulationDiagnostics
            ?.noPickLocation ?? 0,

        multiplePickLocations:
          simulationDiagnostics
            ?.multiplePickLocations ?? 0,
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
      toDateKey(date);


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


function toDateKey(date) {
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


  return `${year}-${month}-${day}`;
}


function capitalizeFirst(value) {
  if (!value) {
    return value;
  }


  return (
    value.charAt(0)
      .toUpperCase() +
    value.slice(1)
  );
}