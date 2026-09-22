import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = path.resolve("data", "analysis", "trendtornado.sqlite");
let database = null;

async function db() {
  if (database) return database;
  await mkdir(path.dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      algorithm_version TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      input_rows INTEGER NOT NULL DEFAULT 0,
      result_blob BLOB,
      is_active INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS analysis_runs_active_idx ON analysis_runs(is_active);
    CREATE INDEX IF NOT EXISTS analysis_runs_created_idx ON analysis_runs(created_at DESC);
  `);
  return database;
}

function metadata(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    algorithmVersion: row.algorithm_version,
    settings: JSON.parse(row.settings_json),
    inputRows: row.input_rows,
    isActive: Boolean(row.is_active),
    errorMessage: row.error_message,
  };
}

export class AnalysisSnapshotRepository {
  static async list() {
    const rows = (await db()).prepare(`
      SELECT id, name, status, period_start, period_end, created_at, completed_at,
             algorithm_version, settings_json, input_rows, is_active, error_message
      FROM analysis_runs ORDER BY created_at DESC, id DESC
    `).all();
    return rows.map(metadata);
  }

  static async getActive() {
    const row = (await db()).prepare(
      "SELECT * FROM analysis_runs WHERE is_active = 1 AND status = 'COMPLETED' LIMIT 1",
    ).get();
    return row ? { ...metadata(row), resultBlob: row.result_blob } : null;
  }

  static async createPending({ name, periodStart, periodEnd, settings, algorithmVersion }) {
    const createdAt = new Date().toISOString();
    const result = (await db()).prepare(`
      INSERT INTO analysis_runs (
        name, status, period_start, period_end, created_at, algorithm_version, settings_json
      ) VALUES (?, 'RUNNING', ?, ?, ?, ?, ?)
    `).run(name, periodStart, periodEnd, createdAt, algorithmVersion, JSON.stringify(settings));
    return Number(result.lastInsertRowid);
  }

  static async complete(id, { resultBlob, inputRows, activate }) {
    const connection = await db();
    connection.exec("BEGIN IMMEDIATE");
    try {
      if (activate) connection.prepare("UPDATE analysis_runs SET is_active = 0").run();
      connection.prepare(`
        UPDATE analysis_runs
        SET status = 'COMPLETED', completed_at = ?, result_blob = ?, input_rows = ?,
            is_active = ?
        WHERE id = ?
      `).run(new Date().toISOString(), resultBlob, inputRows, activate ? 1 : 0, id);
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  static async fail(id, error) {
    (await db()).prepare(`
      UPDATE analysis_runs SET status = 'FAILED', completed_at = ?, error_message = ? WHERE id = ?
    `).run(new Date().toISOString(), String(error?.message ?? error), id);
  }

  static async activate(id) {
    const connection = await db();
    connection.exec("BEGIN IMMEDIATE");
    try {
      const target = connection.prepare(
        "SELECT id FROM analysis_runs WHERE id = ? AND status = 'COMPLETED'",
      ).get(id);
      if (!target) throw new Error("Analysen finns inte eller är inte färdig.");
      connection.prepare("UPDATE analysis_runs SET is_active = 0").run();
      connection.prepare("UPDATE analysis_runs SET is_active = 1 WHERE id = ?").run(id);
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  static async delete(id) {
    const connection = await db();
    const target = connection.prepare("SELECT id, is_active FROM analysis_runs WHERE id = ?").get(Number(id));
    if (!target) throw new Error("Analysen finns inte.");
    if (target.is_active) throw new Error("Den aktiva analysen kan inte tas bort. Aktivera en annan analys först.");
    connection.prepare("DELETE FROM analysis_runs WHERE id = ?").run(Number(id));
  }

  static get path() {
    return databasePath;
  }
}
