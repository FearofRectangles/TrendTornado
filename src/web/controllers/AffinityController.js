import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { buildAffinityViewModel } from "../viewmodels/buildAffinityViewModel.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";

export class AffinityController {
  static async index(req, res, next) {
    try {
      const { data, analysis, run: activeAnalysis, runs: analysisRuns } = await AnalysisSnapshotService.getActive();
      const settings = activeAnalysis.settings;
      const currentSettings = await SettingsRepository.load();
      const pickAreasByName = new Map([
        ...(settings.warehouse?.pickAreas ?? []).map((area) => [area.name, area]),
        ...currentSettings.warehouse.pickAreas.map((area) => [area.name, area]),
      ]);
      const pickAreas = [...pickAreasByName.values()];
      res.render("affinity", {
        title: "Affinitet",
        period: analysis.period,
        importSummary: data.importSummary,
        model: AnalysisSnapshotService.derived(activeAnalysis.id, "affinity-view", () => buildAffinityViewModel({ analysis, historyRecords: data.historyRecords, masterArticles: data.articles, settings })),
        activeAnalysis,
        analysisRuns,
        pickAreas,
        pickAreaColors: Object.fromEntries(pickAreas.map((area) => [area.name, area.color])),
      });
    } catch (error) { next(error); }
  }
}
