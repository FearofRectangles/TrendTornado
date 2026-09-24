import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { readCsvFile } from "./CsvReader.js";

export const PlacementCsvFormat = Object.freeze({
  CONVERTED: "CONVERTED",
  WMS_ITEM_PLACING_LOC: "WMS_ITEM_PLACING_LOC",
});

const formats = [
  {
    name: PlacementCsvFormat.CONVERTED,
    requiredHeaders: ["Zon", "Plats", "Varunummer"],
    normalize: (row) => row,
  },
  {
    name: PlacementCsvFormat.WMS_ITEM_PLACING_LOC,
    requiredHeaders: ["Label", "ShelfLabel", "Material"],
    normalize: (row) => ({
      Zon: row.Label,
      Plats: row.ShelfLabel,
      RepKasseID: row.KasseIDLabel,
      Placering: row.PalletShelf,
      Varunummer: row.Material,
      Beskrivning: row.MatDesc,
      Inköpsorder: row.PurchaseOrderNo,
      Lager: row.CountID,
      Status: row.textbox18,
      "Mottagande datum": row.ReceiptDate,
    }),
  },
];

function parseHeader(line) {
  try {
    return parse(line, { bom: true, relax_column_count: true, trim: true })[0] ?? [];
  } catch {
    return [];
  }
}

export async function readPlacementCsvFile(filePath) {
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  let detected = null;

  for (let index = 0; index < Math.min(lines.length, 50); index += 1) {
    const headers = new Set(parseHeader(lines[index]));
    const format = formats.find((candidate) => (
      candidate.requiredHeaders.every((header) => headers.has(header))
    ));
    if (format) {
      detected = { format, headerLine: index + 1 };
      break;
    }
  }

  if (!detected) {
    throw new Error(
      "Artikelplaceringsfilens format känns inte igen. Förväntade rubriker är Zon/Plats/Varunummer eller Label/ShelfLabel/Material.",
    );
  }

  const sourceRows = await readCsvFile(filePath, { fromLine: detected.headerLine });
  const rows = sourceRows.map(detected.format.normalize);
  const validRows = rows.filter((row) => (
    /^\d{9}$/.test(String(row.Plats ?? "").trim()) && String(row.Varunummer ?? "").trim()
  ));

  return {
    rows,
    diagnostics: {
      format: detected.format.name,
      headerLine: detected.headerLine,
      rawRows: rows.length,
      validRows: validRows.length,
      ignoredRows: rows.length - validRows.length,
    },
  };
}
