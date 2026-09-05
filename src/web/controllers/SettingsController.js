import { stat } from "node:fs/promises";
import path from "node:path";
import { WarehouseDataLoader } from "../../infrastructure/data/WarehouseDataLoader.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";
import { DataFiles } from "../../config/DataFiles.js";
import { getZoneProfiles } from "../../domain/warehouse/zone/ZoneRules.js";

function decimal(value) {
  return Number(String(value ?? "").trim().replace(",", "."));
}

async function loadPageData(settings) {
  const data = await WarehouseDataLoader.load({
    historyPath: DataFiles.history,
    articlePath: DataFiles.articles,
    locationPath: DataFiles.locations,
    placementPath: DataFiles.placements,
  });
  const sources = await Promise.all([
    ["Artikelhistorik", DataFiles.history, data.importSummary.validHistoryRecords, "plockrader"],
    ["Artikeldata", DataFiles.articles, data.importSummary.articleRows, "artiklar"],
    ["Lagerstruktur", DataFiles.locations, data.importSummary.validLocationRows, "platser"],
    ["Artikelplacering", DataFiles.placements, data.importSummary.validPlacementRecords, "placeringar"],
  ].map(async ([label, filePath, count, unit]) => ({
    label,
    fileName: path.basename(filePath),
    count,
    unit,
    modifiedAt: (await stat(filePath)).mtime,
  })));

  return {
    settings,
    sources,
    zoneProfiles: getZoneProfiles(),
    importSummary: data.importSummary,
    periodEnd: data.historyRecords.reduce((latest, record) => (
      !latest || record.postingDate > latest ? record.postingDate : latest
    ), null),
  };
}

export class SettingsController {
  static async index(req, res, next) {
    try {
      const page = await loadPageData(await SettingsRepository.load());
      res.render("settings", {
        title: "Inställningar",
        ...page,
        saved: req.query.saved === "1",
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
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
      },
    };

    try {
      await SettingsRepository.save(candidate);
      res.redirect("/settings?saved=1");
    } catch (error) {
      try {
        const page = await loadPageData(candidate);
        res.status(400).render("settings", {
          title: "Inställningar",
          ...page,
          saved: false,
          error: error.message,
        });
      } catch (renderError) {
        next(renderError);
      }
    }
  }
}
