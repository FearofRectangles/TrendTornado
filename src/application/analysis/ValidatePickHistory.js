import { isExcludedArticle } from "../../domain/analytics/history/PickHistoryRules.js";

export function validatePickHistoryRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError("Rows must be an array.");
  }

const result = {
  totalRows: rows.length,
  outboundRows: 0,
  excludedArticles: 0,
  excludedArticleBreakdown: new Map(),
  invalidDocuments: 0,
  invalidQuantities: 0,
  validRows: 0,
  dateCoverage: new Map(),
};

  for (const row of rows) {
    const documentNumber = row.Dokumentnr?.trim();
    const articleNumber = row.Artikelnr?.trim();

    if (!documentNumber?.startsWith("UT")) {
      result.invalidDocuments++;
      continue;
    }

    if (isExcludedArticle(articleNumber)) {
      result.excludedArticles++;

      const description = row.Artikelbeskrivning?.trim() ?? "";

      const existing =
        result.excludedArticleBreakdown.get(articleNumber);

      if (existing) {
        existing.count++;
      } else {
        result.excludedArticleBreakdown.set(articleNumber, {
          articleNumber,
          description,
          count: 1,
        });
      }

      continue;
    }

    const quantity = Number(
      String(row.Antal)
        .trim()
        .replace(/\s/g, "")
        .replace(",", "."),
    );

    if (!Number.isFinite(quantity)) {
      result.invalidQuantities++;
      continue;
    }

    result.outboundRows++;
result.validRows++;

const date = row.Bokföringsdatum?.trim();

if (date) {
  result.dateCoverage.set(
    date,
    (result.dateCoverage.get(date) ?? 0) + 1,
  );
}
  }

  return result;
}