import { PickHistoryRecord } from "../../../domain/analytics/history/PickHistoryRecord.js";

const excludedArticleNumbers = new Set([
  "134194",
  "134193",
  "7629",
  "7628",
]);

export function mapPickHistoryCsvRow(row) {
  const documentNumber = row.Dokumentnr?.trim();
  const articleNumber = row.Artikelnr?.trim();

  if (!documentNumber?.startsWith("UT")) {
    return null;
  }

  if (excludedArticleNumbers.has(articleNumber)) {
    return null;
  }

  const quantity = parseQuantity(row.Antal);
  const postingDate = parsePostingDate(row.Bokföringsdatum);

  return new PickHistoryRecord({
    postingDate,
    documentNumber,
    articleNumber,
    pickedQuantity: Math.abs(quantity),
  });
}

function parseQuantity(value) {
  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  const quantity = Number(normalized);

  if (!Number.isFinite(quantity)) {
    throw new Error(`Invalid quantity: ${value}`);
  }

  return quantity;
}

function parsePostingDate(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Posting date is required.");
  }

  const [month, day, year] = value.trim().split("/");

  if (!month || !day || !year) {
    throw new Error(`Invalid posting date: ${value}`);
  }

  const fullYear = year.length === 2
    ? 2000 + Number(year)
    : Number(year);

  const date = new Date(
    fullYear,
    Number(month) - 1,
    Number(day),
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid posting date: ${value}`);
  }

  return date;
}