import { readCsvFile } from "../src/infrastructure/csv/CsvReader.js";

import {
  mapPickHistoryCsvRow,
} from "../src/infrastructure/importers/history/PickHistoryCsvMapper.js";

import {
  mapArticleCsvRow,
} from "../src/infrastructure/importers/article/ArticleCsvMapper.js";

import {
  StatisticsEngine,
} from "../src/domain/analytics/statistics/StatisticsEngine.js";

import {
  validatePickHistoryRows,
} from "../src/application/analysis/ValidatePickHistory.js";

import {
  enrichArticleStatistics,
} from "../src/application/analysis/EnrichArticleStatistics.js";

// --------------------------------------------------
// Command line arguments
// --------------------------------------------------

const historyFilePath = process.argv[2];
const articleFilePath = process.argv[3];

if (!historyFilePath || !articleFilePath) {
  console.error(
    "Usage: node scripts/analyze-history.js <history.csv> <articles.csv>",
  );

  process.exit(1);
}

// --------------------------------------------------
// Read CSV files
// --------------------------------------------------

const historyRows = await readCsvFile(
  historyFilePath,
);

const articleRows = await readCsvFile(
  articleFilePath,
);

// --------------------------------------------------
// Validate history
// --------------------------------------------------

const validation =
  validatePickHistoryRows(historyRows);

// --------------------------------------------------
// Map history records
// --------------------------------------------------

const historyRecords = historyRows
  .map(mapPickHistoryCsvRow)
  .filter((record) => record !== null);

if (historyRecords.length === 0) {
  console.log(
    "No valid pick history records found.",
  );

  process.exit(0);
}

// --------------------------------------------------
// Map article master data
// --------------------------------------------------

const articles = articleRows.map(
  mapArticleCsvRow,
);

// --------------------------------------------------
// Determine analysis period
// --------------------------------------------------

const timestamps = historyRecords.map(
  (record) => record.postingDate.getTime(),
);

const periodStart = new Date(
  Math.min(...timestamps),
);

const periodEnd = new Date(
  Math.max(...timestamps),
);

periodStart.setHours(0, 0, 0, 0);
periodEnd.setHours(23, 59, 59, 999);

// --------------------------------------------------
// Calculate statistics
// --------------------------------------------------

const statistics = StatisticsEngine.calculate(
  historyRecords,
  {
    periodStart,
    periodEnd,
  },
);

// --------------------------------------------------
// Enrich statistics with article master data
// --------------------------------------------------

const enrichedStatistics =
  enrichArticleStatistics(
    statistics,
    articles,
  );

const rankedStatistics =
  enrichedStatistics.toSorted(
    (a, b) =>
      b.pickFrequency - a.pickFrequency,
  );

// --------------------------------------------------
// Article-data coverage
// --------------------------------------------------

const missingArticles =
  enrichedStatistics.filter(
    (item) => !item.articleFound,
  );

const matchedArticles =
  enrichedStatistics.filter(
    (item) => item.articleFound,
  );

// --------------------------------------------------
// Temporary enrichment debug
// --------------------------------------------------

console.log("");
console.log("Enrichment debug");
console.log("----------------");

const debugArticleNumbers = [
  "43454",
  "49553",
  "125083",
];

for (const articleNumber of debugArticleNumbers) {
  const item = enrichedStatistics.find(
    (stats) =>
      stats.articleNumber === articleNumber,
  );

  console.log(item ?? `${articleNumber}: NOT FOUND`);
}

// --------------------------------------------------
// Output
// --------------------------------------------------

console.log("");
console.log(
  "TrendTornado History Analysis",
);

console.log(
  "=============================",
);

// --------------------------------------------------
// Date coverage
// --------------------------------------------------

console.log("");
console.log("Date coverage");
console.log("-------------");

const sortedDateCoverage = [
  ...validation.dateCoverage.entries(),
].sort(([dateA], [dateB]) => {
  return new Date(dateA) - new Date(dateB);
});

for (const [date, count] of sortedDateCoverage) {
  console.log(
    `${date.padEnd(12)} ` +
      `${String(count).padStart(6)} valid rows`,
  );
}

// --------------------------------------------------
// Validation
// --------------------------------------------------

console.log("");
console.log("Validation");
console.log("----------");

console.log(
  `CSV rows:             ${validation.totalRows}`,
);

console.log(
  `Valid pick rows:      ${validation.validRows}`,
);

console.log(
  `Non-UT rows:          ${validation.invalidDocuments}`,
);

console.log(
  `Excluded articles:    ${validation.excludedArticles}`,
);

console.log(
  `Invalid quantities:   ${validation.invalidQuantities}`,
);

const accountedRows =
  validation.validRows +
  validation.invalidDocuments +
  validation.excludedArticles +
  validation.invalidQuantities;

console.log(
  `Rows accounted for:  ${accountedRows}/${validation.totalRows}`,
);

// --------------------------------------------------
// Excluded articles
// --------------------------------------------------

console.log("");
console.log(
  "Excluded article breakdown",
);

console.log(
  "--------------------------",
);

const excludedArticles = [
  ...validation.excludedArticleBreakdown.values(),
].sort(
  (a, b) => b.count - a.count,
);

for (const item of excludedArticles) {
  console.log(
    `${item.articleNumber.padEnd(10)} ` +
      `${String(item.count).padStart(6)} rows   ` +
      `${item.description}`,
  );
}

// --------------------------------------------------
// Analysis summary
// --------------------------------------------------

console.log("");
console.log("Analysis");
console.log("--------");

console.log(
  `CSV rows:             ${historyRows.length}`,
);

console.log(
  `Valid pick records:   ${historyRecords.length}`,
);

console.log(
  `Articles analyzed:    ${statistics.length}`,
);

console.log(
  `Period:               ` +
    `${formatDate(periodStart)} - ` +
    `${formatDate(periodEnd)}`,
);

// --------------------------------------------------
// Article-data coverage
// --------------------------------------------------

console.log("");
console.log("Article data coverage");
console.log("---------------------");

console.log(
  `Articles in statistics: ${enrichedStatistics.length}`,
);

console.log(
  `Matched article data:   ${matchedArticles.length}`,
);

console.log(
  `Missing article data:   ${missingArticles.length}`,
);

// --------------------------------------------------
// Most important missing articles
// --------------------------------------------------

if (missingArticles.length > 0) {
  const importantMissingArticles =
    missingArticles.toSorted(
      (a, b) =>
        b.pickFrequency - a.pickFrequency,
    );

  console.log("");
  console.log(
    "Most frequent missing articles",
  );

  console.log(
    "------------------------------",
  );

  for (
    const item
    of importantMissingArticles.slice(0, 10)
  ) {
    console.log(
      `${item.articleNumber.padEnd(10)} ` +
        `${String(item.pickFrequency).padStart(5)} stops   ` +
        `${formatNumber(item.pickedQuantity).padStart(8)} units`,
    );
  }
}

// --------------------------------------------------
// Top articles
// --------------------------------------------------

console.log("");
console.log("Top 10 by pick frequency");
console.log("------------------------");

for (
  const [index, stats]
  of rankedStatistics.slice(0, 10).entries()
) {
  const name =
    stats.name ?? "UNKNOWN";

  const weight =
    stats.weightKg !== null
      ? `${formatNumber(stats.weightKg)} kg`
      : "no weight";

  console.log(
    `${String(index + 1).padStart(2)}. ` +
      `${stats.articleNumber.padEnd(8)} ` +
      `${name.slice(0, 35).padEnd(35)} ` +
      `${String(stats.pickFrequency).padStart(5)} stops   ` +
      `${formatNumber(stats.pickedQuantity).padStart(8)} units   ` +
      `${weight}`,
  );
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function formatDate(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "sv-SE",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}