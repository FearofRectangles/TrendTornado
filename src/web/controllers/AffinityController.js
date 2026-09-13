import { WarehouseDataLoader } from "../../infrastructure/data/WarehouseDataLoader.js";
import { WarehouseAnalysisService } from "../../application/analysis/WarehouseAnalysisService.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";
import { DataFiles } from "../../config/DataFiles.js";
import { buildAffinityViewModel } from "../viewmodels/buildAffinityViewModel.js";

export class AffinityController {
  static async index(req, res, next) {
    try {
      const data = await WarehouseDataLoader.load({ historyPath: DataFiles.history, articlePath: DataFiles.articles, locationPath: DataFiles.locations, placementPath: DataFiles.placements });
      const settings = await SettingsRepository.load();
      const analysis = WarehouseAnalysisService.analyze({ historyRecords: data.historyRecords, articles: data.articles, locations: data.locations, placementRecords: data.placementRecords, settings });
      res.render("affinity", {
        title: "Affinitet",
        period: analysis.period,
        importSummary: data.importSummary,
        model: buildAffinityViewModel({ analysis, historyRecords: data.historyRecords, masterArticles: data.articles, settings }),
      });
    } catch (error) { next(error); }
  }
}
