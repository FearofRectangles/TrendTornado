import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readCsvFile } from "../csv/CsvReader.js";
import { readPlacementCsvFile } from "../csv/PlacementCsvReader.js";
import { DataFiles } from "../../config/DataFiles.js";

export const SourceType = Object.freeze({
  HISTORY: "HISTORY",
  ARTICLES: "ARTICLES",
  LOCATIONS: "LOCATIONS",
  PLACEMENTS: "PLACEMENTS",
});

const databasePath = path.resolve("data", "analysis", "trendtornado.sqlite");
const uploadRoot = path.resolve("data", "uploads", "default");
let database;

function db() {
  if (database) return database;
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS data_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id TEXT NOT NULL DEFAULT 'default',
      source_type TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      effective_at TEXT,
      row_count INTEGER NOT NULL DEFAULT 0,
      period_start TEXT,
      period_end TEXT,
      checksum TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      validation_json TEXT NOT NULL DEFAULT '{}',
      is_managed INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS data_sources_type_status_idx ON data_sources(source_type, status);
    CREATE UNIQUE INDEX IF NOT EXISTS data_sources_checksum_type_idx ON data_sources(source_type, checksum) WHERE status != 'DELETED';
  `);
  return database;
}

const folderByType = {
  [SourceType.HISTORY]: "history",
  [SourceType.ARTICLES]: "articles",
  [SourceType.LOCATIONS]: "locations",
  [SourceType.PLACEMENTS]: "placements",
};

const requiredHeaders = {
  [SourceType.HISTORY]: ["Bokföringsdatum", "Dokumentnr", "Artikelnr"],
  [SourceType.ARTICLES]: ["Nr", "Förvaringstyp"],
  [SourceType.LOCATIONS]: ["Lokation", "Zone", "Lager_Område", "Lager_DelOmråde"],
  [SourceType.PLACEMENTS]: ["Zon", "Plats", "Varunummer"],
};

const fromLineByType = { [SourceType.PLACEMENTS]: 2 };
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

function rowToModel(row) {
  return {
    id: row.id,
    type: row.source_type,
    originalFilename: row.original_filename,
    storedPath: row.stored_path,
    importedAt: row.imported_at,
    effectiveAt: row.effective_at,
    rowCount: row.row_count,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    checksum: row.checksum,
    status: row.status,
    validation: JSON.parse(row.validation_json),
    isManaged: Boolean(row.is_managed),
  };
}

async function diagnostics(filePath, type) {
  if (type === SourceType.PLACEMENTS) {
    const placement = await readPlacementCsvFile(filePath);
    return {
      rowCount: placement.diagnostics.validRows,
      periodStart: null,
      periodEnd: null,
      headers: ["Zon", "Plats", "Varunummer"],
      missingHeaders: [],
      placementFormat: placement.diagnostics.format,
      headerLine: placement.diagnostics.headerLine,
      rawRows: placement.diagnostics.rawRows,
      validRows: placement.diagnostics.validRows,
      ignoredRows: placement.diagnostics.ignoredRows,
    };
  }
  const rows = await readCsvFile(filePath, { fromLine: fromLineByType[type] ?? 1 });
  const headers = Object.keys(rows[0] ?? {});
  const missingHeaders = requiredHeaders[type].filter((header) => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`Filen saknar obligatoriska kolumner: ${missingHeaders.join(", ")}.`);
  let periodStart = null;
  let periodEnd = null;
  if (type === SourceType.HISTORY) {
    const dates = rows.map((row) => {
      const match = String(row.Bokföringsdatum ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
      if (!match) return null;
      const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
      return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    }).filter(Boolean).sort();
    periodStart = dates[0] ?? null;
    periodEnd = dates.at(-1) ?? null;
  }
  return { rowCount: rows.length, periodStart, periodEnd, headers, missingHeaders: [] };
}

async function historyOverlapDiagnostics(filePath) {
  const existingPaths = db().prepare("SELECT stored_path FROM data_sources WHERE source_type = 'HISTORY' AND status = 'ACTIVE'").all();
  const existingDocuments = new Set();
  for (const source of existingPaths) {
    const rows = await readCsvFile(source.stored_path);
    rows.forEach((row) => existingDocuments.add(String(row.Dokumentnr ?? "")));
  }
  const incomingRows = await readCsvFile(filePath);
  const overlappingDocuments = new Set();
  let overlappingRows = 0;
  for (const row of incomingRows) {
    const documentNumber = String(row.Dokumentnr ?? "");
    if (existingDocuments.has(documentNumber)) {
      overlappingDocuments.add(documentNumber);
      overlappingRows += 1;
    }
  }
  return { overlappingDocuments: overlappingDocuments.size, overlappingRows };
}

export class DataSourceRegistry {
  static async ensureBootstrapped() {
    await mkdir(path.dirname(databasePath), { recursive: true });
    const count = db().prepare("SELECT COUNT(*) AS count FROM data_sources").get().count;
    if (count > 0) {
      const incomplete = db().prepare("SELECT id, source_type, stored_path FROM data_sources WHERE row_count = 0 AND status != 'DELETED'").all();
      const update = db().prepare("UPDATE data_sources SET row_count = ?, period_start = ?, period_end = ?, validation_json = ? WHERE id = ?");
      for (const source of incomplete) {
        const validation = await diagnostics(source.stored_path, source.source_type);
        update.run(validation.rowCount, validation.periodStart, validation.periodEnd, JSON.stringify(validation), source.id);
      }
      return;
    }
    const existing = [
      ...DataFiles.history.map((filePath) => [SourceType.HISTORY, filePath]),
      [SourceType.ARTICLES, DataFiles.articles],
      [SourceType.LOCATIONS, DataFiles.locations],
      [SourceType.PLACEMENTS, DataFiles.placements],
    ];
    const insert = db().prepare(`
      INSERT INTO data_sources (source_type, original_filename, stored_path, imported_at, effective_at, row_count, period_start, period_end, checksum, status, validation_json, is_managed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 0)
    `);
    for (const [type, filePath] of existing) {
      const absolutePath = path.resolve(filePath);
      const buffer = await readFile(absolutePath);
      const details = await stat(absolutePath);
      const validation = await diagnostics(absolutePath, type);
      insert.run(type, path.basename(filePath), absolutePath, details.mtime.toISOString(), details.mtime.toISOString().slice(0, 10), validation.rowCount, validation.periodStart, validation.periodEnd, sha256(buffer), JSON.stringify({ ...validation, bootstrapped: true }));
    }
  }

  static async list() {
    await this.ensureBootstrapped();
    return db().prepare("SELECT * FROM data_sources WHERE status != 'DELETED' ORDER BY imported_at DESC, id DESC").all().map(rowToModel);
  }

  static async activePaths() {
    await this.ensureBootstrapped();
    const active = db().prepare("SELECT * FROM data_sources WHERE status = 'ACTIVE' ORDER BY imported_at, id").all().map(rowToModel);
    const one = (type) => active.filter((source) => source.type === type).at(-1)?.storedPath;
    const history = active.filter((source) => source.type === SourceType.HISTORY).map((source) => source.storedPath);
    if (!history.length || !one(SourceType.ARTICLES) || !one(SourceType.LOCATIONS) || !one(SourceType.PLACEMENTS)) {
      throw new Error("En eller flera obligatoriska datakällor saknar en aktiv fil.");
    }
    return { history, articles: one(SourceType.ARTICLES), locations: one(SourceType.LOCATIONS), placements: one(SourceType.PLACEMENTS) };
  }

  static async detectedZones() {
    const files = await this.activePaths();
    const rows = await readCsvFile(files.locations);
    const zones = new Map();
    for (const row of rows) {
      const physicalZone = String(row.Zone ?? row.Lokation?.slice(0, 2) ?? "").padStart(2, "0");
      if (!/^\d{2}$/.test(physicalZone)) continue;
      if (!zones.has(physicalZone)) zones.set(physicalZone, { physicalZone, sourceAreas: new Set(), sourceSubAreas: new Set(), locationCount: 0 });
      const zone = zones.get(physicalZone);
      if (row.Lager_Område) zone.sourceAreas.add(String(row.Lager_Område));
      if (row.Lager_DelOmråde) zone.sourceSubAreas.add(String(row.Lager_DelOmråde));
      zone.locationCount += 1;
    }
    return [...zones.values()].map((zone) => ({ ...zone, sourceAreas: [...zone.sourceAreas].sort(), sourceSubAreas: [...zone.sourceSubAreas].sort() }))
      .toSorted((left, right) => left.physicalZone.localeCompare(right.physicalZone, "sv", { numeric: true }));
  }

  static async import({ type, originalFilename, buffer, effectiveAt = null }) {
    if (!Object.values(SourceType).includes(type)) throw new Error("Okänd typ av datakälla.");
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("CSV-filen är tom.");
    if (buffer.length > 150 * 1024 * 1024) throw new Error("Filen är större än 150 MB.");
    await this.ensureBootstrapped();
    const checksum = sha256(buffer);
    const duplicate = db().prepare("SELECT id FROM data_sources WHERE source_type = ? AND checksum = ? AND status != 'DELETED'").get(type, checksum);
    if (duplicate) throw new Error("Samma fil har redan importerats för denna datakälla.");
    const folder = path.join(uploadRoot, folderByType[type]);
    await mkdir(folder, { recursive: true });
    const safeName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.csv`;
    const stagingPath = path.join(folder, `${safeName}.staging`);
    const finalPath = path.join(folder, safeName);
    await writeFile(stagingPath, buffer);
    let validation;
    try {
      validation = await diagnostics(stagingPath, type);
      if (type === SourceType.HISTORY) validation = { ...validation, ...await historyOverlapDiagnostics(stagingPath) };
      await rename(stagingPath, finalPath);
    } catch (error) {
      await unlink(stagingPath).catch(() => {});
      throw new Error(`Importen stoppades: ${error.message}`);
    }
    const connection = db();
    connection.exec("BEGIN IMMEDIATE");
    try {
      if (type !== SourceType.HISTORY) connection.prepare("UPDATE data_sources SET status = 'SUPERSEDED' WHERE source_type = ? AND status = 'ACTIVE'").run(type);
      const result = connection.prepare(`
        INSERT INTO data_sources (source_type, original_filename, stored_path, imported_at, effective_at, row_count, period_start, period_end, checksum, status, validation_json, is_managed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 1)
      `).run(type, path.basename(originalFilename || "import.csv"), finalPath, new Date().toISOString(), effectiveAt || null, validation.rowCount, validation.periodStart, validation.periodEnd, checksum, JSON.stringify(validation));
      connection.exec("COMMIT");
      return Number(result.lastInsertRowid);
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  static async deactivate(id) {
    await this.ensureBootstrapped();
    const source = db().prepare("SELECT * FROM data_sources WHERE id = ?").get(Number(id));
    if (!source) throw new Error("Datakällan finns inte.");
    if (source.source_type !== SourceType.HISTORY && source.status === "ACTIVE") {
      throw new Error("Aktiv masterdata kan inte inaktiveras utan att en ny version först importeras.");
    }
    db().prepare("UPDATE data_sources SET status = 'INACTIVE' WHERE id = ?").run(Number(id));
  }

  static async activate(id) {
    await this.ensureBootstrapped();
    const connection = db();
    const source = connection.prepare("SELECT * FROM data_sources WHERE id = ? AND status != 'DELETED'").get(Number(id));
    if (!source) throw new Error("Datakällan finns inte.");
    connection.exec("BEGIN IMMEDIATE");
    try {
      if (source.source_type !== SourceType.HISTORY) {
        connection.prepare("UPDATE data_sources SET status = 'SUPERSEDED' WHERE source_type = ? AND status = 'ACTIVE'").run(source.source_type);
      }
      connection.prepare("UPDATE data_sources SET status = 'ACTIVE' WHERE id = ?").run(Number(id));
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }
}
