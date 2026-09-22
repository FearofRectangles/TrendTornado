import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";
import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { DataSourceRegistry, SourceType } from "../../infrastructure/data/DataSourceRegistry.js";

function decimal(value) {
  return Number(String(value ?? "").trim().replace(",", "."));
}

async function loadPageData(settings, snapshotData = null) {
  const data = snapshotData ?? (await AnalysisSnapshotService.getActive()).data;
  const sources = await DataSourceRegistry.list();
  const activeHistoryPeriods = sources.filter((source) => source.type === SourceType.HISTORY && source.status === "ACTIVE" && source.periodStart && source.periodEnd);
  const configuredByZone = new Map(settings.warehouse.zoneMappings.map((mapping) => [mapping.physicalZone, mapping]));
  const detectedZones = (await DataSourceRegistry.detectedZones()).map((zone) => {
    const configured = configuredByZone.get(zone.physicalZone);
    const sourceLabel = [...zone.sourceAreas, ...zone.sourceSubAreas].join(" ").toUpperCase();
    const suggestedTemperature = sourceLabel.includes("FRYS") ? "FRY" : sourceLabel.includes("KYL") || sourceLabel.includes("GRÖN") ? "KYL" : "KOL";
    return {
      ...zone,
      temperatureZone: configured?.temperatureZone ?? suggestedTemperature,
      pickZoneType: configured?.pickZoneType ?? zone.sourceAreas[0]?.toUpperCase() ?? `ZON ${zone.physicalZone}`,
      configured: Boolean(configured),
    };
  });

  return {
    settings,
    sources,
    zoneProfiles: detectedZones,
    dataSources: sources,
    sourceTypes: SourceType,
    importSummary: data.importSummary,
    periodEnd: activeHistoryPeriods.length ? new Date(activeHistoryPeriods.map((source) => source.periodEnd).sort().at(-1)) : data.historyRecords.at(-1)?.postingDate ?? null,
    periodStart: activeHistoryPeriods.length ? new Date(activeHistoryPeriods.map((source) => source.periodStart).sort()[0]) : data.historyRecords[0]?.postingDate ?? null,
    analysisRuns: await AnalysisSnapshotService.list(),
  };
}

export class SettingsController {
  static async index(req, res, next) {
    try {
      const snapshot = await AnalysisSnapshotService.getActive();
      const page = await loadPageData(await SettingsRepository.load(), snapshot.data);
      page.analysisRuns = snapshot.runs;
      const activeAnalysis = snapshot.run;
      res.render("settings", {
        title: "Inställningar",
        ...page,
        saved: req.query.saved === "1",
        error: null,
        analysisError: req.query.analysisError ?? null,
        analysisCreated: req.query.analysisCreated === "1",
        dataImported: req.query.dataImported === "1",
        dataSourceChanged: req.query.dataSourceChanged === "1",
        importError: req.query.importError ?? null,
        zonesSaved: req.query.zonesSaved === "1",
        pickAreasSaved: req.query.pickAreasSaved === "1",
        analysisDeleted: req.query.analysisDeleted === "1",
        activeAnalysis,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    const currentSettings = await SettingsRepository.load();
    const candidate = {
      analysis: {
        movementThreshold: decimal(req.body.movementThreshold) / 100,
        frequencyWeight: decimal(req.body.frequencyWeight) / 100,
        handlingWeight: decimal(req.body.handlingWeight) / 100,
      },
      ergonomics: {
        lowPreferredKg: decimal(req.body.lowPreferredKg),
        lowStronglyRecommendedKg: decimal(req.body.lowStronglyRecommendedKg),
      },
      distance: {
        standardBayWidthMeters: decimal(req.body.standardBayWidthMeters),
        beamThicknessCm: decimal(req.body.beamThicknessCm),
      },
      classification: {
        abcAThreshold: decimal(req.body.abcAThreshold) / 100,
        abcBThreshold: decimal(req.body.abcBThreshold) / 100,
      },
      warehouse: currentSettings.warehouse,
    };

    try {
      await SettingsRepository.save(candidate);
      res.redirect("/settings?saved=1");
    } catch (error) {
      try {
        const page = await loadPageData(candidate);
        const snapshot = await AnalysisSnapshotService.getActive();
        page.analysisRuns = snapshot.runs;
        res.status(400).render("settings", {
          title: "Inställningar",
          ...page,
          saved: false,
          error: error.message,
          analysisError: null,
          analysisCreated: false,
          dataImported: false,
          dataSourceChanged: false,
          importError: null,
          zonesSaved: false,
          pickAreasSaved: false,
          analysisDeleted: false,
          activeAnalysis: snapshot.run,
        });
      } catch (renderError) {
        next(renderError);
      }
    }
  }

  static async createAnalysis(req, res) {
    try {
      await AnalysisSnapshotService.create({
        name: req.body.name,
        periodStart: req.body.periodStart,
        periodEnd: req.body.periodEnd,
        settings: await SettingsRepository.load(),
        activate: req.body.activate === "1",
      });
      res.redirect("/settings?analysisCreated=1");
    } catch (error) {
      res.redirect(`/settings?analysisError=${encodeURIComponent(error.message)}`);
    }
  }

  static async activateAnalysis(req, res, next) {
    try {
      await AnalysisSnapshotService.activate(req.body.analysisId);
      const destination = String(req.body.returnTo ?? "/");
      res.redirect(destination.startsWith("/") && !destination.startsWith("//") ? destination : "/");
    } catch (error) {
      next(error);
    }
  }

  static async deleteAnalysis(req, res) {
    try {
      await AnalysisSnapshotService.delete(req.body.analysisId);
      res.redirect("/settings?analysisDeleted=1#analyses");
    } catch (error) {
      res.redirect(`/settings?analysisError=${encodeURIComponent(error.message)}#analyses`);
    }
  }

  static async importDataSource(req, res) {
    try {
      const originalFilename = decodeURIComponent(req.get("X-File-Name") ?? "import.csv");
      await DataSourceRegistry.import({
        type: String(req.get("X-Source-Type") ?? ""),
        originalFilename,
        effectiveAt: req.get("X-Effective-At") || null,
        buffer: req.body,
      });
      res.status(201).json({ redirect: "/settings?dataImported=1#data-sources" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deactivateDataSource(req, res) {
    try {
      await DataSourceRegistry.deactivate(req.body.sourceId);
      res.redirect("/settings?dataSourceChanged=1#data-sources");
    } catch (error) {
      res.redirect(`/settings?importError=${encodeURIComponent(error.message)}#data-sources`);
    }
  }

  static async activateDataSource(req, res) {
    try {
      await DataSourceRegistry.activate(req.body.sourceId);
      res.redirect("/settings?dataSourceChanged=1#data-sources");
    } catch (error) {
      res.redirect(`/settings?importError=${encodeURIComponent(error.message)}#data-sources`);
    }
  }

  static async saveZoneMappings(req, res) {
    try {
      const values = (value) => Array.isArray(value) ? value : [value];
      const physicalZones = values(req.body.physicalZone);
      const temperatures = values(req.body.temperatureZone);
      const pickAreas = values(req.body.pickZoneType);
      const current = await SettingsRepository.load();
      await SettingsRepository.save({
        ...current,
        warehouse: {
          ...current.warehouse,
          pickAreas: current.warehouse.pickAreas,
          zoneMappings: physicalZones.map((physicalZone, index) => ({
            physicalZone,
            temperatureZone: temperatures[index],
            pickZoneType: pickAreas[index],
          })),
        },
      });
      res.redirect("/settings?zonesSaved=1#warehouse-rules");
    } catch (error) {
      res.redirect(`/settings?importError=${encodeURIComponent(error.message)}#warehouse-rules`);
    }
  }

  static async savePickAreas(req, res) {
    try {
      const values = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
      const originalNames = values(req.body.originalName).map((value) => String(value).trim().toUpperCase());
      const names = values(req.body.pickAreaName);
      const colors = values(req.body.pickAreaColor);
      const renameMap = new Map(originalNames.map((name, index) => [name, String(names[index] ?? "").trim().toUpperCase()]));
      const current = await SettingsRepository.load();
      await SettingsRepository.save({
        ...current,
        warehouse: {
          ...current.warehouse,
          pickAreas: names.map((name, index) => ({ name, color: colors[index] })),
          zoneMappings: current.warehouse.zoneMappings.map((mapping) => ({
            ...mapping,
            pickZoneType: renameMap.get(mapping.pickZoneType) ?? mapping.pickZoneType,
          })),
        },
      });
      res.redirect("/settings?pickAreasSaved=1#pick-areas");
    } catch (error) {
      res.redirect(`/settings?importError=${encodeURIComponent(error.message)}#pick-areas`);
    }
  }
}
