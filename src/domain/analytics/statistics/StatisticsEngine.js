import { ArticleStatistics } from "./ArticleStatistics.js";
import { PickHistoryRecord } from "../history/PickHistoryRecord.js";

export class StatisticsEngine {
  static calculate(historyRecords, { periodStart, periodEnd }) {
    this.#assertHistoryRecords(historyRecords);
    this.#assertPeriod(periodStart, periodEnd);

    const groupedByArticle = new Map();

    for (const record of historyRecords) {
      if (
        record.postingDate < periodStart ||
        record.postingDate > periodEnd
      ) {
        continue;
      }

      let articleData = groupedByArticle.get(record.articleNumber);

      if (!articleData) {
        articleData = {
          documentNumbers: new Set(),
          pickedQuantity: 0,
        };

        groupedByArticle.set(record.articleNumber, articleData);
      }

      articleData.documentNumbers.add(record.documentNumber);
      articleData.pickedQuantity += record.pickedQuantity;
    }

    return Array.from(
      groupedByArticle,
      ([articleNumber, data]) =>
        new ArticleStatistics({
          articleNumber,
          periodStart,
          periodEnd,
          pickFrequency: data.documentNumbers.size,
          pickedQuantity: data.pickedQuantity,
        }),
    );
  }

  static #assertHistoryRecords(historyRecords) {
    if (!Array.isArray(historyRecords)) {
      throw new TypeError("History records must be an array.");
    }

    for (const record of historyRecords) {
      if (!(record instanceof PickHistoryRecord)) {
        throw new TypeError(
          "Every history record must be a PickHistoryRecord.",
        );
      }
    }
  }

  static #assertPeriod(periodStart, periodEnd) {
    if (!(periodStart instanceof Date) || !(periodEnd instanceof Date)) {
      throw new TypeError("Analysis period must use Date objects.");
    }

    if (periodStart > periodEnd) {
      throw new Error("Period start cannot be after period end.");
    }
  }
}