import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

export async function readCsvFile(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new TypeError("CSV file path is required.");
  }

  const content = await readFile(filePath, "utf8");

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}