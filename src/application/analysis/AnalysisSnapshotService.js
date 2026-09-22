import { serialize, deserialize } from "node:v8";
import { WarehouseDataLoader } from "../../infrastructure/data/WarehouseDataLoader.js";
import { AnalysisSnapshotRepository } from "../../infrastructure/analysis/AnalysisSnapshotRepository.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";
import { DataSourceRegistry } from "../../infrastructure/data/DataSourceRegistry.js";
import { WarehouseAnalysisService } from "./WarehouseAnalysisService.js";
import { Location } from "../../domain/warehouse/location/Location.js";
import { configureZoneMappings } from "../../domain/warehouse/zone/ZoneRules.js";
import { DEFAULT_SETTINGS } from "../../config/DefaultSettings.js";

const ALGORITHM_VERSION = "1.0";
let activeCache = null;
const derivedCache = new Map();

export function restoreSnapshotPrototypes(value, visited = new WeakSet()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return value;
  visited.add(value);

  if (
    typeof value.locationCode === "string" &&
    /^\d{9}$/.test(value.locationCode) &&
    typeof value.purpose === "string"
  ) {
    Object.setPrototypeOf(value, Location.prototype);
  }

  if (value instanceof Map) {
    value.forEach((entry, key) => {
      restoreSnapshotPrototypes(key, visited);
      restoreSnapshotPrototypes(entry, visited);
    });
  } else if (value instanceof Set) {
    value.forEach((entry) => restoreSnapshotPrototypes(entry, visited));
  } else {
    Object.values(value).forEach((entry) => restoreSnapshotPrototypes(entry, visited));
  }
  return value;
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Ett giltigt datumintervall krävs.");
  return date.toISOString().slice(0, 10);
}

async function sourceData(settings = null) {
  const activeSettings = settings ?? await SettingsRepository.load();
  configureZoneMappings(activeSettings.warehouse.zoneMappings);
  const files = await DataSourceRegistry.activePaths();
  const data = await WarehouseDataLoader.load({
    historyPath: files.history,
    articlePath: files.articles,
    locationPath: files.locations,
    placementPath: files.placements,
  });
  const sourceManifest = (await DataSourceRegistry.list()).filter((source) => source.status === "ACTIVE").map((source) => ({
    id: source.id,
    type: source.type,
    originalFilename: source.originalFilename,
    checksum: source.checksum,
    effectiveAt: source.effectiveAt,
  }));
  return { ...data, sourceManifest };
}

export class AnalysisSnapshotService {
  static async create({ name, periodStart, periodEnd, settings, activate = false }) {
    const start = dateKey(periodStart);
    const end = dateKey(periodEnd);
    if (start > end) throw new RangeError("Startdatum måste vara före slutdatum.");
    const analysisName = String(name ?? "").trim() || `Analys ${end}`;
    const usedSettings = settings ?? await SettingsRepository.load();
    const id = await AnalysisSnapshotRepository.createPending({
      name: analysisName,
      periodStart: start,
      periodEnd: end,
      settings: usedSettings,
      algorithmVersion: ALGORITHM_VERSION,
    });

    try {
      const data = await sourceData(usedSettings);
      const historyRecords = data.historyRecords.filter((record) => {
        const key = record.postingDate.toISOString().slice(0, 10);
        return key >= start && key <= end;
      });
      if (historyRecords.length === 0) throw new Error("Datumintervallet innehåller inga giltiga plockrader.");
      const snapshotData = {
        ...data,
        historyRecords,
        importSummary: { ...data.importSummary, validHistoryRecords: historyRecords.length },
      };
      const analysis = WarehouseAnalysisService.analyze({
        historyRecords,
        articles: data.articles,
        locations: data.locations,
        placementRecords: data.placementRecords,
        settings: usedSettings,
      });
      const payload = { data: snapshotData, analysis };
      await AnalysisSnapshotRepository.complete(id, {
        resultBlob: serialize(payload),
        inputRows: historyRecords.length,
        activate,
      });
      if (activate) activeCache = { id, payload };
      if (activate) derivedCache.clear();
      return id;
    } catch (error) {
      await AnalysisSnapshotRepository.fail(id, error);
      throw error;
    }
  }

  static async getActive() {
    const stored = await AnalysisSnapshotRepository.getActive();
    if (!stored) {
      const initialSettings = await SettingsRepository.load();
      const data = await sourceData(initialSettings);
      const dates = data.historyRecords.map((record) => record.postingDate).sort((a, b) => a - b);
      await this.create({
        name: "Grundanalys",
        periodStart: dates[0],
        periodEnd: dates.at(-1),
        settings: initialSettings,
        activate: true,
      });
      return this.getActive();
    }
    configureZoneMappings(stored.settings.warehouse?.zoneMappings ?? DEFAULT_SETTINGS.warehouse.zoneMappings);
    if (activeCache?.id === stored.id) {
      return { run: stored, ...activeCache.payload, runs: await AnalysisSnapshotRepository.list() };
    }
    const payload = restoreSnapshotPrototypes(deserialize(stored.resultBlob));
    activeCache = { id: stored.id, payload };
    return { run: stored, ...payload, runs: await AnalysisSnapshotRepository.list() };
  }

  static async activate(id) {
    await AnalysisSnapshotRepository.activate(Number(id));
    activeCache = null;
    derivedCache.clear();
  }

  static derived(runId, key, factory) {
    const cacheKey = `${runId}:${key}`;
    if (!derivedCache.has(cacheKey)) derivedCache.set(cacheKey, factory());
    return derivedCache.get(cacheKey);
  }

  static async list() {
    return AnalysisSnapshotRepository.list();
  }

  static async delete(id) {
    await AnalysisSnapshotRepository.delete(Number(id));
    derivedCache.clear();
  }

  static async availablePeriod() {
    const data = await sourceData(await SettingsRepository.load());
    const dates = data.historyRecords.map((record) => record.postingDate).sort((a, b) => a - b);
    return { start: dates[0], end: dates.at(-1), data };
  }
}
