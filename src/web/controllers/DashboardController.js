import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import {
  buildRelocationViewModel,
} from "../viewmodels/buildRelocationViewModel.js";
import { DEFAULT_SETTINGS } from "../../config/DefaultSettings.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";


export class DashboardController {

  static async index(req, res, next) {
    try {
      const {
        data,
        analysis,
        run: activeAnalysis,
        runs: analysisRuns,
      } = await AnalysisSnapshotService.getActive();

      const currentSettings = await SettingsRepository.load();
      const configuredPickAreas = currentSettings.warehouse?.pickAreas
        ?? DEFAULT_SETTINGS.warehouse.pickAreas;
      const pickAreaColors = Object.fromEntries(
        configuredPickAreas.map((area) => [area.name, area.color]),
      );


      // --------------------------------------------------
      // Recommendations
      // --------------------------------------------------

      const relocationCandidates =
        buildRelocationViewModel(analysis, activeAnalysis.settings);
      const dashboardRecommendations = relocationCandidates.slice(0, 50);

      const packageSizeOrder = new Map([["SMALL", 0], ["STANDARD", 1], ["LARGE", 2]]);
      const packagesByZone = new Map();
      for (const packagePlan of analysis.relocationPackages?.packages ?? []) {
        if (!packagesByZone.has(packagePlan.pickZone)) packagesByZone.set(packagePlan.pickZone, []);
        packagesByZone.get(packagePlan.pickZone).push({
          ...packagePlan,
          efficiency: packagePlan.steps.length > 0
            ? packagePlan.objectiveGain / packagePlan.steps.length
            : 0,
        });
      }
      const pickAreaOrder = new Map(configuredPickAreas.map((area, index) => [area.name, index]));
      const packageGroups = [...packagesByZone].map(([pickZone, packages]) => {
        const ordered = packages.toSorted((left, right) => (
          (packageSizeOrder.get(left.size) ?? 99) - (packageSizeOrder.get(right.size) ?? 99)
        ));
        const recommended = ordered.toSorted((left, right) => right.efficiency - left.efficiency)[0];
        return {
          pickZone,
          color: pickAreaColors[pickZone] ?? "#78827a",
          packages: ordered.map((packagePlan) => ({
            ...packagePlan,
            recommended: packagePlan.id === recommended?.id,
          })),
        };
      }).toSorted((left, right) => (
        (pickAreaOrder.get(left.pickZone) ?? 999) - (pickAreaOrder.get(right.pickZone) ?? 999) ||
        left.pickZone.localeCompare(right.pickZone, "sv")
      ));


      // --------------------------------------------------
      // Dashboard thresholds
      // --------------------------------------------------

      const strongGapThreshold =
        analysis.simulation.movementThreshold;

      const positionDeviations = analysis.evaluations.all.filter((evaluation) => (
        Math.abs(evaluation.placementGap) >= strongGapThreshold
      )).length;


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
      // Operational dashboard metrics
      // --------------------------------------------------

      const observedWeekCount = Math.max(
        1,
        analysis.articles.classification?.observedWeekCount ?? 0,
      );
      const candidateArticleNumbers = new Set(
        relocationCandidates.map((item) => String(item.articleNumber)),
      );
      const zoneWorkload = new Map();
      let totalStops = 0;
      let totalCandidateStops = 0;

      for (const article of analysis.articles.positioned) {
        const stops = Number(article.pickFrequency) || 0;
        totalStops += stops;
        if (candidateArticleNumbers.has(String(article.articleNumber))) {
          totalCandidateStops += stops;
        }
        const positioned = article.positionedPickLocations?.[0];
        if (!positioned?.location?.pickZoneType) continue;
        const name = positioned.location.pickZoneType;
        const quantity = Number(article.pickedQuantity) || 0;
        const handledWeight = Number.isFinite(article.weightKg)
          ? quantity * article.weightKg
          : 0;
        const current = zoneWorkload.get(name) ?? {
          name,
          stops: 0,
          quantity: 0,
          handledWeight: 0,
          candidateStops: 0,
        };
        current.stops += stops;
        current.quantity += quantity;
        current.handledWeight += handledWeight;
        if (candidateArticleNumbers.has(String(article.articleNumber))) {
          current.candidateStops += stops;
        }
        zoneWorkload.set(name, current);
      }

      const pickZones = [...zoneWorkload.values()].map((zone) => ({
        ...zone,
        color: pickAreaColors[zone.name] ?? "#78827a",
        stopsPerWeek: zone.stops / observedWeekCount,
        quantityPerWeek: zone.quantity / observedWeekCount,
        handledWeightPerWeek: zone.handledWeight / observedWeekCount,
        candidateActivityShare: zone.stops > 0 ? zone.candidateStops / zone.stops : 0,
      })).toSorted((left, right) => (
        (pickAreaOrder.get(left.name) ?? 999) - (pickAreaOrder.get(right.name) ?? 999) ||
        left.name.localeCompare(right.name, "sv")
      ));

      const totalDocuments = analysis.simulation.diagnostics?.totalDocuments ?? 0;
      const operationalSummary = {
        observedWeekCount,
        stopsPerWeek: totalStops / observedWeekCount,
        ordersPerWeek: totalDocuments / observedWeekCount,
        stopsPerOrder: totalDocuments > 0 ? totalStops / totalDocuments : 0,
        currentMultiPickSpan: analysis.simulation.baseline?.averageMultiPickSpan ?? 0,
        candidateActivityShare: totalStops > 0 ? totalCandidateStops / totalStops : 0,
      };


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

        flowCoverage:
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

            positionDeviations,

            lowPlacementRecommendations:
              lowPlacementRecommendations
                .length,
          },

          operationalSummary,

          simulation:
            simulationSummary,

          calendar,

          importSummary:
            data.importSummary,

          recommendations:
            dashboardRecommendations,

          packageGroups,

          pickZones,

          strongGapThreshold,
          activeAnalysis,
          analysisRuns,
          pickAreaColors,
        },
      );

    } catch (error) {
      next(error);
    }
  }

  static async calendar(req, res, next) {
    try {
      const { data, analysis } = await AnalysisSnapshotService.getActive();
      const requestedMonth = /^\d{4}-\d{2}$/.test(String(req.query.month ?? ""))
        ? String(req.query.month)
        : `${analysis.period.end.getFullYear()}-${String(analysis.period.end.getMonth() + 1).padStart(2, "0")}`;
      const [year, month] = requestedMonth.split("-").map(Number);
      const periodEnd = new Date(year, month - 1, 15);
      if (Number.isNaN(periodEnd.getTime()) || month < 1 || month > 12) return res.status(400).json({ error: "Ogiltig månad." });
      return res.json(buildCalendar({ historyRecords: data.historyRecords, periodEnd }));
    } catch (error) {
      return next(error);
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
    monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
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
