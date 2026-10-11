import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readCsvFile } from "../csv/CsvReader.js";
import { readPlacementCsvFile } from "../csv/PlacementCsvReader.js";
import { readMovementCsvFile } from "../csv/MovementCsvReader.js";
import { DataFiles } from "../../config/DataFiles.js";
import { OfficeContext } from "../../config/OfficeContext.js";

export const SourceType = Object.freeze({
  HISTORY: "HISTORY",
  ARTICLES: "ARTICLES",
  LOCATIONS: "LOCATIONS",
  PLACEMENTS: "PLACEMENTS",
  MOVEMENTS: "MOVEMENTS",
});

const databasePath = path.resolve("data", "analysis", "trendtornado.sqlite");
const uploadRoot = path.join(OfficeContext.dataRoot, "uploads");
const legacyUploadRoot = path.resolve("data", "uploads", "default");
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
  `);
  const columns = new Set(
    database.prepare("PRAGMA table_info(data_sources)").all().map((column) => column.name),
  );
  const migrations = [
    ["warehouse_id", "ALTER TABLE data_sources ADD COLUMN warehouse_id TEXT NOT NULL DEFAULT 'default'"],
    ["row_count", "ALTER TABLE data_sources ADD COLUMN row_count INTEGER NOT NULL DEFAULT 0"],
    ["period_start", "ALTER TABLE data_sources ADD COLUMN period_start TEXT"],
    ["period_end", "ALTER TABLE data_sources ADD COLUMN period_end TEXT"],
    ["validation_json", "ALTER TABLE data_sources ADD COLUMN validation_json TEXT NOT NULL DEFAULT '{}'"],
    ["is_managed", "ALTER TABLE data_sources ADD COLUMN is_managed INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [column, statement] of migrations) {
    if (!columns.has(column)) database.exec(statement);
  }
  if (OfficeContext.id === "KALMAR") {
    database.prepare("UPDATE data_sources SET warehouse_id = ? WHERE warehouse_id = 'default'").run(OfficeContext.id);
  }
  database.exec("DROP INDEX IF EXISTS data_sources_checksum_type_idx");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS data_sources_checksum_type_idx ON data_sources(warehouse_id, source_type, checksum) WHERE status != 'DELETED'");
  return database;
}

const folderByType = {
  [SourceType.HISTORY]: "history",
  [SourceType.ARTICLES]: "articles",
  [SourceType.LOCATIONS]: "locations",
  [SourceType.PLACEMENTS]: "placements",
  [SourceType.MOVEMENTS]: "movements",
};

const requiredHeaders = {
  [SourceType.HISTORY]: ["Bokföringsdatum", "Dokumentnr", "Artikelnr"],
  [SourceType.ARTICLES]: ["Nr", "Förvaringstyp"],
  [SourceType.LOCATIONS]: ["Lokation", "Zone", "Lager_Område", "Lager_DelOmråde"],
  [SourceType.PLACEMENTS]: ["Zon", "Plats", "Varunummer"],
};

const fromLineByType = { [SourceType.PLACEMENTS]: 2 };
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

function storedValidation(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function rowToModel(row) {
  return {
    id: row.id,
    officeId: row.warehouse_id,
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
    validation: storedValidation(row.validation_json),
    // Replaced legacy sources are removable from the registry even though
    // their original, deployment-owned file must not be unlinked.
    isManaged: Boolean(row.is_managed) || row.status !== "ACTIVE",
  };
}

async function diagnostics(filePath, type) {
  if (type === SourceType.MOVEMENTS) {
    const movement = await readMovementCsvFile(filePath);
    if (!movement.records.length) throw new Error("Filen innehåller inga giltiga plocktransaktioner med ordernummer O…, plats och tid.");
    return { rowCount: movement.diagnostics.validRows, periodStart: movement.diagnostics.periodStart, periodEnd: movement.diagnostics.periodEnd, movementFormat: movement.diagnostics.format, calendarDatesLocal: true, ...movement.diagnostics };
  }
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
  const existingPaths = db().prepare("SELECT stored_path FROM data_sources WHERE warehouse_id = ? AND source_type = 'HISTORY' AND status = 'ACTIVE'").all(OfficeContext.id);
  const existingDocuments = new Set();
  for (const source of existingPaths) {
    let rows;
    try {
      rows = await readCsvFile(source.stored_path);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
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
    const count = db().prepare("SELECT COUNT(*) AS count FROM data_sources WHERE warehouse_id = ?").get(OfficeContext.id).count;
    if (count > 0) {
      const incomplete = db().prepare(`
        SELECT id, source_type, stored_path, status, is_managed, validation_json
        FROM data_sources
        WHERE warehouse_id = ? AND status != 'DELETED'
          AND (
            row_count = 0
            OR (source_type = 'MOVEMENTS' AND validation_json NOT LIKE '%\"calendarDatesLocal\":true%')
          )
          AND validation_json NOT LIKE '%\"missingFile\":true%'
      `).all(OfficeContext.id);
      const update = db().prepare("UPDATE data_sources SET row_count = ?, period_start = ?, period_end = ?, validation_json = ? WHERE id = ? AND warehouse_id = ?");
      for (const source of incomplete) {
        try {
          const validation = await diagnostics(source.stored_path, source.source_type);
          update.run(validation.rowCount, validation.periodStart, validation.periodEnd, JSON.stringify(validation), source.id, OfficeContext.id);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
          const validation = {
            ...storedValidation(source.validation_json),
            missingFile: true,
            error: "Den registrerade filen finns inte längre på servern.",
          };
          if (source.status !== "ACTIVE") {
            db().prepare("UPDATE data_sources SET status = 'DELETED', validation_json = ? WHERE id = ? AND warehouse_id = ?")
              .run(JSON.stringify(validation), source.id, OfficeContext.id);
          } else {
            db().prepare("UPDATE data_sources SET validation_json = ? WHERE id = ? AND warehouse_id = ?")
              .run(JSON.stringify(validation), source.id, OfficeContext.id);
          }
        }
      }
      return;
    }
    const existing = [
      ...DataFiles.history.map((filePath) => [SourceType.HISTORY, filePath]),
      [SourceType.ARTICLES, DataFiles.articles],
      [SourceType.LOCATIONS, DataFiles.locations],
      [SourceType.PLACEMENTS, DataFiles.placements],
    ].filter(([, filePath]) => Boolean(filePath));
    const insert = db().prepare(`
      INSERT INTO data_sources (warehouse_id, source_type, original_filename, stored_path, imported_at, effective_at, row_count, period_start, period_end, checksum, status, validation_json, is_managed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 0)
    `);
    for (const [type, filePath] of existing) {
      const absolutePath = path.resolve(filePath);
      const buffer = await readFile(absolutePath);
      const details = await stat(absolutePath);
      const validation = await diagnostics(absolutePath, type);
      insert.run(OfficeContext.id, type, path.basename(filePath), absolutePath, details.mtime.toISOString(), details.mtime.toISOString().slice(0, 10), validation.rowCount, validation.periodStart, validation.periodEnd, sha256(buffer), JSON.stringify({ ...validation, bootstrapped: true }));
    }
  }

  static async list() {
    await this.ensureBootstrapped();
    return db().prepare("SELECT * FROM data_sources WHERE warehouse_id = ? AND status != 'DELETED' ORDER BY imported_at DESC, id DESC").all(OfficeContext.id).map(rowToModel);
  }

  static async activePaths() {
    await this.ensureBootstrapped();
    const active = db().prepare("SELECT * FROM data_sources WHERE warehouse_id = ? AND status = 'ACTIVE' ORDER BY imported_at, id").all(OfficeContext.id).map(rowToModel);
    const one = (type) => active.filter((source) => source.type === type).at(-1)?.storedPath;
    const movements = active.filter((source) => source.type === SourceType.MOVEMENTS).map((source) => source.storedPath);
    if (!movements.length || !one(SourceType.ARTICLES) || !one(SourceType.LOCATIONS) || !one(SourceType.PLACEMENTS)) {
      throw new Error("En eller flera obligatoriska datakällor saknas. Plockhistorik från WMS, artikeldata, lagerstruktur och artikelplacering måste ha en aktiv fil.");
    }
    return { history: [], movements, articles: one(SourceType.ARTICLES), locations: one(SourceType.LOCATIONS), placements: one(SourceType.PLACEMENTS) };
  }

  static async detectedZones() {
    await this.ensureBootstrapped();
    const locationSource = db().prepare("SELECT stored_path FROM data_sources WHERE warehouse_id = ? AND source_type = 'LOCATIONS' AND status = 'ACTIVE' ORDER BY imported_at DESC, id DESC LIMIT 1").get(OfficeContext.id);
    if (!locationSource) return [];
    let rows;
    try {
      rows = await readCsvFile(locationSource.stored_path);
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
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
    const duplicate = db().prepare("SELECT id FROM data_sources WHERE warehouse_id = ? AND source_type = ? AND checksum = ? AND status != 'DELETED'").get(OfficeContext.id, type, checksum);
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
      if (![SourceType.HISTORY, SourceType.MOVEMENTS].includes(type)) connection.prepare("UPDATE data_sources SET status = 'SUPERSEDED' WHERE warehouse_id = ? AND source_type = ? AND status = 'ACTIVE'").run(OfficeContext.id, type);
      const result = connection.prepare(`
        INSERT INTO data_sources (warehouse_id, source_type, original_filename, stored_path, imported_at, effective_at, row_count, period_start, period_end, checksum, status, validation_json, is_managed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 1)
      `).run(OfficeContext.id, type, path.basename(originalFilename || "import.csv"), finalPath, new Date().toISOString(), effectiveAt || null, validation.rowCount, validation.periodStart, validation.periodEnd, checksum, JSON.stringify(validation));
      connection.exec("COMMIT");
      return Number(result.lastInsertRowid);
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  static async deactivate(id) {
    await this.ensureBootstrapped();
    const source = db().prepare("SELECT * FROM data_sources WHERE id = ? AND warehouse_id = ?").get(Number(id), OfficeContext.id);
    if (!source) throw new Error("Datakällan finns inte.");
    if (![SourceType.HISTORY, SourceType.MOVEMENTS].includes(source.source_type) && source.status === "ACTIVE") {
      throw new Error("Aktiv masterdata kan inte inaktiveras utan att en ny version först importeras.");
    }
    db().prepare("UPDATE data_sources SET status = 'INACTIVE' WHERE id = ? AND warehouse_id = ?").run(Number(id), OfficeContext.id);
  }

  static async activate(id) {
    await this.ensureBootstrapped();
    const connection = db();
    const source = connection.prepare("SELECT * FROM data_sources WHERE id = ? AND warehouse_id = ? AND status != 'DELETED'").get(Number(id), OfficeContext.id);
    if (!source) throw new Error("Datakällan finns inte.");
    connection.exec("BEGIN IMMEDIATE");
    try {
      if (![SourceType.HISTORY, SourceType.MOVEMENTS].includes(source.source_type)) {
        connection.prepare("UPDATE data_sources SET status = 'SUPERSEDED' WHERE warehouse_id = ? AND source_type = ? AND status = 'ACTIVE'").run(OfficeContext.id, source.source_type);
      }
      connection.prepare("UPDATE data_sources SET status = 'ACTIVE' WHERE id = ? AND warehouse_id = ?").run(Number(id), OfficeContext.id);
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  static async delete(id) {
    await this.ensureBootstrapped();
    const source = db().prepare("SELECT * FROM data_sources WHERE id = ? AND warehouse_id = ? AND status != 'DELETED'").get(Number(id), OfficeContext.id);
    if (!source) throw new Error("Datakällan finns inte eller är redan borttagen.");
    if (!source.is_managed) {
      if (source.status === "ACTIVE") {
        throw new Error("Den äldre systemfilen måste ersättas innan den kan tas bort ur registret.");
      }
      db().prepare("UPDATE data_sources SET status = 'DELETED' WHERE id = ? AND warehouse_id = ?")
        .run(Number(id), OfficeContext.id);
      return;
    }
    if (![SourceType.HISTORY, SourceType.MOVEMENTS].includes(source.source_type) && source.status === "ACTIVE") {
      throw new Error("En aktiv masterdatafil måste ersättas innan den kan tas bort.");
    }
    if ([SourceType.HISTORY, SourceType.MOVEMENTS].includes(source.source_type) && source.status === "ACTIVE") {
      const activeCount = db().prepare("SELECT COUNT(*) AS count FROM data_sources WHERE warehouse_id = ? AND source_type = ? AND status = 'ACTIVE'").get(OfficeContext.id, source.source_type).count;
      if (source.source_type === SourceType.HISTORY && activeCount <= 1) throw new Error("Den sista aktiva historikfilen kan inte tas bort.");
    }

    const storedPath = path.resolve(source.stored_path);
    const allowedRoots = [uploadRoot, ...(OfficeContext.id === "KALMAR" ? [legacyUploadRoot] : [])];
    const isManagedUpload = allowedRoots.some((root) => {
      const relativePath = path.relative(root, storedPath);
      return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    });
    if (!isManagedUpload) {
      throw new Error("Filen ligger utanför TrendTornados uppladdningsmapp och kan inte tas bort.");
    }

    await unlink(storedPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    db().prepare("UPDATE data_sources SET status = 'DELETED' WHERE id = ? AND warehouse_id = ?").run(Number(id), OfficeContext.id);
  }
}
