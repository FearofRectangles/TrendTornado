import {
  WarehouseDataLoader,
} from "../../infrastructure/data/WarehouseDataLoader.js";
import {
  WarehouseAnalysisService,
} from "../../application/analysis/WarehouseAnalysisService.js";
import {
  DataFiles,
} from "../../config/DataFiles.js";
import {
  buildRelocationViewModel,
} from "../viewmodels/buildRelocationViewModel.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";

const VALID_VIEWS = new Set(["all", "earlier", "later"]);

export class RelocationController {
  static async index(req, res, next) {
    try {
      const requestedView = String(req.params.view ?? "all").toLowerCase();
      const activeView = VALID_VIEWS.has(requestedView) ? requestedView : "all";
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
      const recommendations = buildRelocationViewModel(analysis);
      const earlier = recommendations.filter((item) => item.direction === "EARLIER");
      const later = recommendations.filter((item) => item.direction === "LATER");
      const ergonomic = recommendations.filter((item) => (
        item.ergonomicRecommendation === "LOW_PREFERRED" ||
        item.ergonomicRecommendation === "LOW_STRONGLY_RECOMMENDED"
      ));
      const visibleRecommendations = activeView === "earlier"
        ? earlier
        : activeView === "later"
          ? later
          : recommendations;

      const unique = (values) => [...new Set(values.map(String))]
        .sort((a, b) => a.localeCompare(b, "sv", { numeric: true }));

      res.render("relocations", {
        title: "Flyttare",
        activeView,
        period: analysis.period,
        importSummary: data.importSummary,
        strongGapThreshold: analysis.simulation.movementThreshold,
        summary: {
          total: recommendations.length,
          earlier: earlier.length,
          later: later.length,
          ergonomic: ergonomic.length,
        },
        recommendations: visibleRecommendations,
        filters: {
          pickZones: unique(recommendations.map((item) => item.pickZone)),
          currentZones: unique(recommendations.map((item) => item.currentZone)),
          recommendedZones: unique(recommendations.map((item) => item.recommendedZone)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
