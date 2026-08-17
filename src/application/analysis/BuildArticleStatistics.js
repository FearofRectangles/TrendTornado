import { mapPickHistoryCsvRow } from "../../infrastructure/importers/history/PickHistoryCsvMapper.js";
import { StatisticsEngine } from "../../domain/analytics/statistics/StatisticsEngine.js";

export function buildArticleStatistics(
  rows,
  { periodStart, periodEnd },
) {
  if (!Array.isArray(rows)) {
    throw new TypeError("Rows must be an array.");
  }

  const historyRecords = rows
    .map(mapPickHistoryCsvRow)
    .filter((record) => record !== null);

  return StatisticsEngine.calculate(historyRecords, {
    periodStart,
    periodEnd,
  });
}
