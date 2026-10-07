import { readCsvFile } from "./CsvReader.js";

function decimal(value) {
  return Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", "."));
}

function timestamp(value) {
  const match = String(value ?? "").trim().match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function mapMovementRow(row) {
  const orderNumber = String(row.ActivityId ?? "").trim();
  const worker = String(row.WorkerName ?? "").trim();
  const articleNumber = String(row.Textbox168 ?? "").trim();
  const sourceLocation = String(row.textbox26 ?? "").trim();
  const occurredAt = timestamp(row.textbox29);
  const quantity = decimal(row.textbox28);
  if (!/^O\d+$/.test(orderNumber) || !worker || !articleNumber || !/^\d{9}$/.test(sourceLocation) || !occurredAt || !Number.isFinite(quantity) || quantity === 0) return null;
  return {
    orderNumber,
    worker,
    orderType: String(row.textbox23 ?? "").trim(),
    clientName: String(row.ClientName ?? "").trim(),
    articleNumber,
    articleName: String(row.MaterialDescription ?? "").trim(),
    quantity: Math.abs(quantity),
    sourceLocation,
    loadCarrier: String(row.textbox27 ?? "").trim(),
    warehouseFrom: String(row.c_WarehouseFrom ?? "").trim(),
    warehouseTo: String(row.c_WarehouseTo ?? "").trim(),
    occurredAt,
  };
}

export async function readMovementCsvFile(filePath) {
  const rows = await readCsvFile(filePath, { fromLine: 4 });
  const records = rows.map(mapMovementRow).filter(Boolean);
  const timestamps = records.map((record) => record.occurredAt).sort((a, b) => a - b);
  return {
    records,
    diagnostics: {
      format: "WMS_GOODS_MOVEMENTS",
      rawRows: rows.length,
      validRows: records.length,
      ignoredRows: rows.length - records.length,
      orderCount: new Set(records.map((record) => record.orderNumber)).size,
      periodStart: timestamps[0] ? localDateKey(timestamps[0]) : null,
      periodEnd: timestamps.length ? localDateKey(timestamps.at(-1)) : null,
    },
  };
}
