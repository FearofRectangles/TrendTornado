import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { buildAnalysisViewModel } from "../viewmodels/buildAnalysisViewModel.js";

export class AnalysisController {
  static async index(req, res, next) {
    try {
      const { data, analysis, run: activeAnalysis, runs: analysisRuns } = await AnalysisSnapshotService.getActive();
      res.render("analysis", {
        title: "Analys",
        period: analysis.period,
        importSummary: data.importSummary,
        model: AnalysisSnapshotService.derived(activeAnalysis.id, "analysis-view", () => buildAnalysisViewModel(analysis)),
        activeAnalysis,
        analysisRuns,
      });
    } catch (error) {
      next(error);
    }
  }
}
