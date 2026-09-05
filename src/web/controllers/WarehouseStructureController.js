import { WarehouseDataLoader } from "../../infrastructure/data/WarehouseDataLoader.js";
import { WarehouseAnalysisService } from "../../application/analysis/WarehouseAnalysisService.js";
import { DataFiles } from "../../config/DataFiles.js";
import { buildWarehouseStructureViewModel } from "../viewmodels/buildWarehouseStructureViewModel.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";

export class WarehouseStructureController {
  static async index(req, res, next) {
    try {
      const data = await WarehouseDataLoader.load({
        historyPath: DataFiles.history,
        articlePath: DataFiles.articles,
        locationPath: DataFiles.locations,
        placementPath: DataFiles.placements,
      });
      const settings = await SettingsRepository.load();
      const analysis = WarehouseAnalysisService.analyze({
        historyRecords: data.historyRecords,
        articles: data.articles,
        locations: data.locations,
        placementRecords: data.placementRecords,
        settings,
      });
      res.render("warehouse-structure", {
        title: "Lagerstruktur",
        period: analysis.period,
        importSummary: data.importSummary,
        model: buildWarehouseStructureViewModel(analysis),
      });
    } catch (error) {
      next(error);
    }
  }
}
