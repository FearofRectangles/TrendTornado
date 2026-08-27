import { readCsvFile } from "../src/infrastructure/csv/CsvReader.js";

import {
  mapPickHistoryCsvRow,
} from "../src/infrastructure/importers/history/PickHistoryCsvMapper.js";

import {
  mapArticleCsvRow,
} from "../src/infrastructure/importers/article/ArticleCsvMapper.js";

import {
  mapLocationCsvRow,
} from "../src/infrastructure/importers/location/LocationCsvMapper.js";

import {
  mapPlacementCsvRow,
} from "../src/infrastructure/importers/placement/PlacementCsvMapper.js";

import {
  StatisticsEngine,
} from "../src/domain/analytics/statistics/StatisticsEngine.js";

import {
  PlacementEvaluationEngine,
} from "../src/domain/analytics/placement/PlacementEvaluationEngine.js";

import {
  LocationPurpose,
} from "../src/domain/shared/LocationPurpose.js";

import {
  enrichArticleStatistics,
} from "../src/application/analysis/EnrichArticleStatistics.js";

import {
  attachPickPlacements,
} from "../src/application/analysis/AttachPickPlacements.js";

import {
  attachPickSequence,
} from "../src/application/analysis/AttachPickSequence.js";

import {
  buildPlacements,
} from "../src/application/warehouse/BuildPlacements.js";

import {
  buildPickSequence,
} from "../src/application/warehouse/BuildPickSequence.js";

import {
  buildPhysicalZoneSequence,
} from "../src/application/warehouse/BuildPhysicalZoneSequence.js";

import {
  buildBayFlow,
} from "../src/application/warehouse/BuildBayFlow.js";

import {
  resolveIdealPlacementArea,
} from "../src/application/optimization/ResolveIdealPlacementArea.js";

import {
  PlacementDiagnostics,
} from "../src/domain/analytics/placement/PlacementDiagnostics.js";

import {
  ErgonomicRecommendationEngine,
} from "../src/domain/analytics/placement/ErgonomicRecommendationEngine.js";


// --------------------------------------------------
// Arguments
// --------------------------------------------------

const historyFilePath =
  process.argv[2];

const articleFilePath =
  process.argv[3];

const locationFilePath =
  process.argv[4];

const placementFilePath =
  process.argv[5];

if (
  !historyFilePath ||
  !articleFilePath ||
  !locationFilePath ||
  !placementFilePath
) {
  console.error(
    "Usage: node scripts/analyze-warehouse.js <history.csv> <articles.csv> <locations.csv> <placements.csv>",
  );

  process.exit(1);
}


// --------------------------------------------------
// Read CSV files
// --------------------------------------------------

const historyRows =
  await readCsvFile(
    historyFilePath,
  );

const articleRows =
  await readCsvFile(
    articleFilePath,
  );

const locationRows =
  await readCsvFile(
    locationFilePath,
  );

const placementRows =
  await readCsvFile(
    placementFilePath,
    {
      fromLine: 2,
    },
  );


// --------------------------------------------------
// History
// --------------------------------------------------

const historyRecords =
  historyRows
    .map(mapPickHistoryCsvRow)
    .filter(
      (record) =>
        record !== null,
    );

if (
  historyRecords.length === 0
) {
  console.log(
    "No valid pick history records found.",
  );

  process.exit(0);
}


// --------------------------------------------------
// Articles
// --------------------------------------------------

const articles =
  articleRows.map(
    mapArticleCsvRow,
  );


// --------------------------------------------------
// Locations
// --------------------------------------------------

const validLocationRows = [];
const invalidLocationRows = [];

for (const row of locationRows) {
  const locationCode =
    String(
      row.Lokation ?? "",
    ).trim();

  if (
    /^\d{9}$/.test(
      locationCode,
    )
  ) {
    validLocationRows.push(
      row,
    );
  } else {
    invalidLocationRows.push(
      row,
    );
  }
}

const locations =
  validLocationRows.map(
    mapLocationCsvRow,
  );


// --------------------------------------------------
// Placement records
// --------------------------------------------------

const placementRecords =
  placementRows
    .map(
      mapPlacementCsvRow,
    )
    .filter(
      (record) =>
        record !== null,
    );


// --------------------------------------------------
// Build placements
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
      placement.location
        .purpose ===
      LocationPurpose.PICK,
  );


// --------------------------------------------------
// Build PICK sequence
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
// Determine analysis period
// --------------------------------------------------

const timestamps =
  historyRecords.map(
    (record) =>
      record.postingDate
        .getTime(),
  );

const periodStart =
  new Date(
    Math.min(
      ...timestamps,
    ),
  );

const periodEnd =
  new Date(
    Math.max(
      ...timestamps,
    ),
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


// --------------------------------------------------
// Enrich statistics with article data
// --------------------------------------------------

const enrichedStatistics =
  enrichArticleStatistics(
    statistics,
    articles,
  );


// --------------------------------------------------
// Attach PICK placements
// --------------------------------------------------

const analyzedArticles =
  attachPickPlacements(
    enrichedStatistics,
    pickPlacements,
  );


// --------------------------------------------------
// Attach PICK sequence
// --------------------------------------------------

const positionedArticles =
  attachPickSequence(
    analyzedArticles,
    pickSequence,
  );


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
          article.positionedPickLocations.length === 0
        ) {
          return null;
        }

        const positioned =
          article.positionedPickLocations[0];

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
          ErgonomicRecommendationEngine.evaluate({
            weightKg:
              article.weightKg,

            averageHandledWeightPerPick:
              evaluation.averageHandledWeightPerPick,
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
      article.pickLocations
        .length > 0,
  );

const articlesWithoutPickLocation =
  positionedArticles.filter(
    (article) =>
      article.pickLocations
        .length === 0,
  );

const articlesWithMultiplePickLocations =
  positionedArticles.filter(
    (article) =>
      article.pickLocations
        .length > 1,
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
// Output
// --------------------------------------------------

console.log("");

console.log(
  "TrendTornado Warehouse Analysis",
);

console.log(
  "===============================",
);


// --------------------------------------------------
// Import summary
// --------------------------------------------------

console.log("");
console.log("Import");
console.log("------");

console.log(
  `History rows:          ${historyRows.length}`,
);

console.log(
  `Valid pick records:    ${historyRecords.length}`,
);

console.log(
  `Article rows:          ${articleRows.length}`,
);

console.log(
  `Location rows:         ${locationRows.length}`,
);

console.log(
  `Valid location rows:   ${validLocationRows.length}`,
);

console.log(
  `Invalid locations:     ${invalidLocationRows.length}`,
);

console.log(
  `Placement records:     ${placementRecords.length}`,
);


// --------------------------------------------------
// Warehouse structure
// --------------------------------------------------

console.log("");

console.log(
  "Warehouse structure",
);

console.log(
  "-------------------",
);

console.log(
  `PICK sequence entries: ${pickSequence.length}`,
);

const sequenceByZone =
  new Map();

for (
  const entry
  of pickSequence
) {
  const zone =
    entry.pickZoneType;

  sequenceByZone.set(
    zone,
    (
      sequenceByZone.get(
        zone,
      ) ?? 0
    ) + 1,
  );
}

for (
  const [zone, count]
  of sequenceByZone
) {
  console.log(
    `${zone.padEnd(20)} ${count}`,
  );
}

console.log("");
console.log("Physical zones");
console.log("--------------");

const physicalZoneCounts =
  new Map();

for (const entry of physicalZoneSequence) {
  physicalZoneCounts.set(
    entry.zone,
    (
      physicalZoneCounts.get(
        entry.zone,
      ) ?? 0
    ) + 1,
  );
}

for (
  const [zone, count]
  of [...physicalZoneCounts.entries()]
    .sort(
      ([zoneA], [zoneB]) =>
        zoneA.localeCompare(zoneB),
    )
) {
  console.log(
    `Zone ${zone}: ${count} PICK locations`,
  );
}

// --------------------------------------------------
// Placements
// --------------------------------------------------

console.log("");
console.log("Placements");
console.log("----------");

console.log(
  `Valid placements:      ${placementResult.placements.length}`,
);

console.log(
  `Valid PICK placements: ${pickPlacements.length}`,
);

console.log(
  `Missing articles:      ${placementResult.missingArticles.length}`,
);

console.log(
  `Missing locations:     ${placementResult.missingLocations.length}`,
);

console.log(
  `Rejected placements:   ${placementResult.rejectedPlacements.length}`,
);


// --------------------------------------------------
// Combined analysis
// --------------------------------------------------

console.log("");

console.log(
  "Combined analysis",
);

console.log(
  "-----------------",
);

console.log(
  `Articles analyzed:              ${positionedArticles.length}`,
);

console.log(
  `Articles with PICK location:    ${articlesWithPickLocation.length}`,
);

console.log(
  `Articles without PICK location: ${articlesWithoutPickLocation.length}`,
);

console.log(
  `Multiple PICK locations:        ${articlesWithMultiplePickLocations.length}`,
);

console.log(
  `Articles with sequence data:    ${articlesWithPosition.length}`,
);

console.log(
  `Placement evaluations:          ${placementEvaluations.length}`,
);

console.log(
  `Period:                         ${formatDate(periodStart)} - ${formatDate(periodEnd)}`,
);


// --------------------------------------------------
// Top articles by frequency
// --------------------------------------------------

console.log("");

console.log(
  "Top 20 by pick frequency",
);

console.log(
  "------------------------",
);

for (
  const [index, article]
  of rankedArticles
    .slice(0, 20)
    .entries()
) {
  const name =
    article.name ??
    "UNKNOWN";

  const weight =
    article.weightKg !== null
      ? `${formatNumber(
          article.weightKg,
        )} kg`
      : "no weight";

  const articleLocations =
    article
      .positionedPickLocations
      .length > 0
      ? article
          .positionedPickLocations
          .map(
            (positioned) => {
              const code =
                positioned
                  .location
                  .locationCode;

              const relativePosition =
                positioned
                  .relativePickPosition !==
                null
                  ? `${(
                      positioned
                        .relativePickPosition *
                      100
                    ).toFixed(
                      1,
                    )}%`
                  : "?";

              return (
                `${code} ` +
                `(${relativePosition})`
              );
            },
          )
          .join(", ")
      : "NO PICK LOCATION";

  console.log(
    `${String(
      index + 1,
    ).padStart(2)}. ` +
      `${article.articleNumber.padEnd(
        8,
      )} ` +
      `${name
        .slice(0, 30)
        .padEnd(30)} ` +
      `${String(
        article.pickFrequency,
      ).padStart(5)} stops   ` +
      `${weight.padStart(
        10,
      )}   ` +
      `${articleLocations}`,
  );
}


// --------------------------------------------------
// Detailed top 10
// --------------------------------------------------

console.log("");

console.log(
  "Detailed top 10",
);

console.log(
  "---------------",
);

for (
  const article
  of rankedArticles.slice(
    0,
    10,
  )
) {
  console.log("");

  console.log(
    `${article.articleNumber} - ${article.name ?? "UNKNOWN"}`,
  );

  console.log(
    `  Weight:             ${
      article.weightKg !== null
        ? `${formatNumber(
            article.weightKg,
          )} kg`
        : "unknown"
    }`,
  );

  console.log(
    `  Pick frequency:     ${article.pickFrequency}`,
  );

  console.log(
    `  Picked quantity:    ${formatNumber(
      article.pickedQuantity,
    )}`,
  );

  console.log(
    `  Avg / pick:         ${formatNumber(
      article.averageQuantityPerPick,
    )}`,
  );

  if (
    article
      .positionedPickLocations
      .length === 0
  ) {
    console.log(
      "  PICK location:      NONE",
    );

    continue;
  }

  for (
    const positioned
    of article
      .positionedPickLocations
  ) {
    const location =
      positioned.location;

    console.log(
      `  PICK location:      ${location.locationCode}`,
    );

    console.log(
      `    Zone:             ${location.zone}`,
    );

    console.log(
      `    Bay:              ${location.bay}`,
    );

    console.log(
      `    Shelf:            ${location.shelf}`,
    );

    console.log(
      `    Position:         ${location.position}`,
    );

    console.log(
      `    Pick zone:        ${location.pickZoneType}`,
    );

    console.log(
      `    Temperature:      ${location.temperatureZone}`,
    );

    if (
      positioned
        .pickSequence === null
    ) {
      console.log(
        "    Sequence:         unknown",
      );

      console.log(
        "    Relative position: unknown",
      );

      continue;
    }

    console.log(
      `    Sequence:         ` +
        `${positioned.pickSequence} / ` +
        `${positioned.totalPickLocations}`,
    );

    console.log(
      `    Relative position: ${formatPercentage(
        positioned.relativePickPosition,
      )}`,
    );
  }
}


console.log("");
console.log(
  "Priority score distribution",
);
console.log(
  "---------------------------",
);

for (
  const [
    pickZoneType,
    diagnostics,
  ]
  of placementDiagnostics
) {
  console.log("");
  console.log(pickZoneType);

  console.log(
    `Articles:           ${diagnostics.count}`,
  );

  console.log(
    `Frequency score:    ${formatScore(
      diagnostics.frequencyScore.min,
    )} / ${formatScore(
      diagnostics.frequencyScore.median,
    )} / ${formatScore(
      diagnostics.frequencyScore.max,
    )}   (min / median / max)`,
  );

  console.log(
    `Handling score:     ${formatScore(
      diagnostics.handlingScore.min,
    )} / ${formatScore(
      diagnostics.handlingScore.median,
    )} / ${formatScore(
      diagnostics.handlingScore.max,
    )}`,
  );

  console.log(
    `Priority score:     ${formatScore(
      diagnostics.priorityScore.min,
    )} / ${formatScore(
      diagnostics.priorityScore.median,
    )} / ${formatScore(
      diagnostics.priorityScore.max,
    )}`,
  );

  console.log("");
  console.log(
    "Priority percentiles:",
  );

  console.log(
    `  P10: ${formatScore(
      diagnostics.priorityScore.p10,
    )}`,
  );

  console.log(
    `  P25: ${formatScore(
      diagnostics.priorityScore.p25,
    )}`,
  );

  console.log(
    `  P50: ${formatScore(
      diagnostics.priorityScore.median,
    )}`,
  );

  console.log(
    `  P75: ${formatScore(
      diagnostics.priorityScore.p75,
    )}`,
  );

  console.log(
    `  P90: ${formatScore(
      diagnostics.priorityScore.p90,
    )}`,
  );
}

// --------------------------------------------------
// Relocation candidates
// --------------------------------------------------

console.log("");

console.log(
  "Top relocation candidates",
);

console.log(
  "-------------------------",
);

for (
  const [index, evaluation]
  of rankedEvaluations
    .slice(0, 20)
    .entries()
) {
  const article =
    articlesByNumber.get(
      evaluation.articleNumber,
    );

  const positionedLocation =
    article
      .positionedPickLocations[0];

  const location =
    positionedLocation.location;

  


  console.log(
    `${String(
      index + 1,
    ).padStart(2)}. ` +
      `${evaluation.articleNumber.padEnd(
        8,
      )} ` +
      `${(
        article.name ??
        "UNKNOWN"
      )
        .slice(0, 28)
        .padEnd(28)} ` +
      `gap ${formatSignedPercentage(
        evaluation.placementGap,
      ).padStart(8)}   ` +
      `now ${formatPercentage(
        evaluation.currentPosition,
      ).padStart(8)}   ` +
      `target ${formatPercentage(
        evaluation.desiredPosition,
      ).padStart(8)}   ` +
      `${location.locationCode}`,
  );
}


// --------------------------------------------------
// Detailed relocation candidates
// --------------------------------------------------

console.log("");

console.log(
  "Detailed relocation candidates",
);

console.log(
  "------------------------------",
);

for (
  const evaluation
  of rankedEvaluations.slice(
    0,
    10,
  )
) {
  const article =
    articlesByNumber.get(
      evaluation.articleNumber,
    );

  const positionedLocation =
    article
      .positionedPickLocations[0];

  const location =
    positionedLocation.location;

  const physicalZonePosition =
  physicalZoneByLocationCode.get(
    location.locationCode,
  );

  console.log("");

  console.log(
    `${article.articleNumber} - ${article.name ?? "UNKNOWN"}`,
  );

  console.log(
    `  Pick zone:          ${location.pickZoneType}`,
  );

  console.log(
    `  Current location:   ${location.locationCode}`,
  );

  console.log(
  `  Physical zone:      ${location.zone}`,
);

if (physicalZonePosition) {
  console.log(
  `  Bay sequence:       ` +
    `${physicalZonePosition.baySequence} / ` +
    `${physicalZonePosition.totalZoneBays}`,
);

  console.log(
    `  Position in zone:   ${formatPercentage(
      physicalZonePosition.relativeZonePosition,
    )}`,
  );

  console.log(
    `  Zone section:       ${physicalZonePosition.zoneSection}`,
  );
}

  console.log(
    `  Weight:             ${formatNumber(
      article.weightKg,
    )} kg`,
  );

  console.log(
    `  Pick frequency:     ${article.pickFrequency}`,
  );

  console.log(
    `  Frequency score:    ${formatScore(
      evaluation.frequencyScore,
    )}`,
  );

  console.log(
    `  Avg handled / pick: ${formatNumber(
      evaluation.averageHandledWeightPerPick,
    )} kg`,
  );

  console.log(
    `  Handling score:     ${formatScore(
      evaluation.handlingScore,
    )}`,
  );

  console.log(
    `  Priority score:     ${formatScore(
      evaluation.priorityScore,
    )}`,
  );

  console.log(
    `  Current position:   ${formatPercentage(
      evaluation.currentPosition,
    )}`,
  );

  console.log(
    `  Desired position:   ${formatPercentage(
      evaluation.desiredPosition,
    )}`,
  );

  console.log(
    `  Placement gap:      ${formatSignedPercentage(
      evaluation.placementGap,
    )}`,
  );
}

console.log("");
console.log("Relocation recommendations");
console.log("--------------------------");

console.log("");
console.log("Relocation recommendations");
console.log("--------------------------");

for (
  const [index, recommendation]
  of relocationRecommendations
    .slice(0, 20)
    .entries()
) {
  const {
    evaluation,
    article,
    currentLocation,
    currentPhysicalPosition,
    recommendedArea,
    ergonomicRecommendation,
  } = recommendation;

  if (!recommendedArea) {
    continue;
  }

  const currentSection =
    currentPhysicalPosition?.zoneSection ??
    "UNKNOWN";

  console.log("");

  console.log(
    `${String(index + 1).padStart(2)}. ` +
    `${article.articleNumber} - ` +
    `${article.name ?? "UNKNOWN"}`,
  );

  console.log(
    `    Current:      Zone ${currentLocation.zone} - ${currentSection}`,
  );

  console.log(
    `    Recommended:  Zone ${recommendedArea.zone} - ${recommendedArea.section}`,
  );

  console.log(
    `    Movement:     ${currentLocation.zone} ${currentSection}` +
    ` -> ${recommendedArea.zone} ${recommendedArea.section}`,
  );

  console.log(
    `    Priority gap: ${formatSignedPercentage(
      evaluation.placementGap,
    )}`,
  );

  console.log(
    `    Ergonomics:   ${ergonomicRecommendation.recommendation}`,
  );

  console.log(
    `    Handling:     ${formatNumber(
      evaluation.averageHandledWeightPerPick,
    )} kg avg / pick`,
  );
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function formatDate(date) {
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

function formatNumber(value) {
  return new Intl.NumberFormat(
    "sv-SE",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatPercentage(
  value,
) {
  if (value === null) {
    return "unknown";
  }

  return `${(
    value * 100
  ).toFixed(1)} %`;
}

function formatSignedPercentage(
  value,
) {
  if (value === null) {
    return "unknown";
  }

  const percentage =
    value * 100;

  const sign =
    percentage > 0
      ? "+"
      : "";

  return (
    `${sign}` +
    `${percentage.toFixed(1)} %`
  );
}

function formatScore(value) {
  return value.toFixed(3);
}