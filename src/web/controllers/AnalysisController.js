import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { buildAnalysisViewModel } from "../viewmodels/buildAnalysisViewModel.js";
import { buildAffinityViewModel } from "../viewmodels/buildAffinityViewModel.js";

export class AnalysisController {
  static async index(req, res, next) {
    try {
      const { data, analysis, run: activeAnalysis, runs: analysisRuns } = await AnalysisSnapshotService.getActive();
      const affinityModel = AnalysisSnapshotService.derived(activeAnalysis.id, "affinity-view", () => (
        buildAffinityViewModel({
          analysis,
          historyRecords: data.historyRecords,
          masterArticles: data.articles,
          settings: activeAnalysis.settings,
        })
      ));
      const pickAreaPresentation = Object.fromEntries(
        (activeAnalysis.settings.warehouse?.pickAreas ?? []).map((area, index) => [
          area.name,
          { color: area.color, order: index },
        ]),
      );
      res.render("analysis", {
        title: "Analys",
        period: analysis.period,
        importSummary: data.importSummary,
        model: AnalysisSnapshotService.derived(activeAnalysis.id, "analysis-view", () => (
          buildAnalysisViewModel(analysis, affinityModel, pickAreaPresentation)
        )),
        activeAnalysis,
        analysisRuns,
      });
    } catch (error) {
      next(error);
    }
  }
}
