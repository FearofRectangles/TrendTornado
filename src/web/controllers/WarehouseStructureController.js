import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { buildWarehouseStructureViewModel } from "../viewmodels/buildWarehouseStructureViewModel.js";

export class WarehouseStructureController {
  static async index(req, res, next) {
    try {
      const { data, analysis, run: activeAnalysis, runs: analysisRuns } = await AnalysisSnapshotService.getActive();
      res.render("warehouse-structure", {
        title: "Lagerstruktur",
        period: analysis.period,
        importSummary: data.importSummary,
        model: AnalysisSnapshotService.derived(activeAnalysis.id, "warehouse-view", () => buildWarehouseStructureViewModel(analysis)),
        activeAnalysis,
        analysisRuns,
      });
    } catch (error) {
      next(error);
    }
  }
}
