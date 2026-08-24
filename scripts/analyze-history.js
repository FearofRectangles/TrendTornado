import { readCsvFile } from "../src/infrastructure/csv/CsvReader.js";
import { mapPickHistoryCsvRow } from "../src/infrastructure/importers/history/PickHistoryCsvMapper.js";
import { StatisticsEngine } from "../src/domain/analytics/statistics/StatisticsEngine.js";

const filePath = process.argv[2];

if (!filePath) {
  console.error(
    "Usage: node scripts/analyze-history.js <path-to-history.csv>",
  );
  process.exit(1);
}

const rows = await readCsvFile(filePath);

const historyRecords = rows
  .map(mapPickHistoryCsvRow)
  .filter((record) => record !== null);

if (historyRecords.length === 0) {
  console.log("No valid pick history records found.");
  process.exit(0);
}

const timestamps = historyRecords.map(
  (record) => record.postingDate.getTime(),
);

const periodStart = new Date(Math.min(...timestamps));
const periodEnd = new Date(Math.max(...timestamps));

periodStart.setHours(0, 0, 0, 0);
periodEnd.setHours(23, 59, 59, 999);

const statistics = StatisticsEngine.calculate(historyRecords, {
  periodStart,
  periodEnd,
});

const rankedStatistics = statistics.toSorted(
  (a, b) => b.pickFrequency - a.pickFrequency,
);

console.log("");
console.log("TrendTornado History Analysis");
console.log("=============================");
console.log("");
console.log(`CSV rows:           ${rows.length}`);
console.log(`Valid pick records: ${historyRecords.length}`);
console.log(`Articles analyzed:  ${statistics.length}`);
console.log(
  `Period:             ${formatDate(periodStart)} - ${formatDate(periodEnd)}`,
);

console.log("");
console.log("Top 10 by pick frequency");
console.log("------------------------");

for (const [index, stats] of rankedStatistics.slice(0, 10).entries()) {
  console.log(
    `${String(index + 1).padStart(2)}. ` +
      `${stats.articleNumber.padEnd(10)} ` +
      `${String(stats.pickFrequency).padStart(6)} stops   ` +
      `${formatNumber(stats.pickedQuantity).padStart(8)} units`,
  );
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value);
}