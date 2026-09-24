import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { RelocationPdfReport } from "../../infrastructure/reports/RelocationPdfReport.js";
import {
  buildRelocationViewModel,
} from "../viewmodels/buildRelocationViewModel.js";
import { DEFAULT_SETTINGS } from "../../config/DefaultSettings.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";

const VALID_VIEWS = new Set(["all", "earlier", "later"]);
const placementOptionsByArticle = new Map();

export class RelocationController {
  static async index(req, res, next) {
    try {
      const requestedView = String(req.params.view ?? "all").toLowerCase();
      const activeView = VALID_VIEWS.has(requestedView) ? requestedView : "all";
      const { data, analysis, run: activeAnalysis, runs: analysisRuns } = await AnalysisSnapshotService.getActive();
      const currentSettings = await SettingsRepository.load();
      const configuredPickAreas = currentSettings.warehouse?.pickAreas
        ?? DEFAULT_SETTINGS.warehouse.pickAreas;
      const pickAreaColors = Object.fromEntries(
        configuredPickAreas.map((area) => [area.name, area.color]),
      );
      const recommendations = AnalysisSnapshotService.derived(activeAnalysis.id, "relocations", () => buildRelocationViewModel(analysis, activeAnalysis.settings));
      placementOptionsByArticle.clear();
      recommendations.forEach((item) => {
        placementOptionsByArticle.set(String(item.articleNumber), item.placementOptions ?? null);
      });
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
      const drawerRecommendations = visibleRecommendations.map((item) => ({
        articleNumber: item.articleNumber,
        name: item.name,
        currentZone: item.currentZone,
        currentLocation: item.currentLocation,
        currentSection: item.currentSection,
        currentFloorHeightCm: item.currentFloorHeightCm,
        currentPosition: item.currentPosition,
        recommendedZone: item.recommendedZone,
        recommendedSection: item.recommendedSection,
        desiredPosition: item.desiredPosition,
        placementGap: item.placementGap,
        direction: item.direction,
        ergonomicRecommendation: item.ergonomicRecommendation,
        ergonomicReason: item.ergonomicReason,
        averageHandledWeightPerPick: item.averageHandledWeightPerPick,
        pickFrequency: item.pickFrequency,
        pickedQuantityPerWeek: item.pickedQuantityPerWeek,
        observedWeekCount: item.observedWeekCount,
        averageQuantityPerPick: item.averageQuantityPerPick,
        classification: item.classification
          ? { classification: item.classification.classification }
          : null,
        utility: item.utility,
      }));

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
        recommendations: visibleRecommendations.map(({ placementOptions, ...item }) => item),
        drawerRecommendations,
        filters: {
          pickZones: unique(recommendations.map((item) => item.pickZone)),
          currentZones: unique(recommendations.map((item) => item.currentZone)),
          recommendedZones: unique(recommendations.map((item) => item.recommendedZone)),
        },
        activeAnalysis,
        analysisRuns,
        pickAreaColors,
      });
    } catch (error) {
      next(error);
    }
  }

  static placementOptions(req, res) {
    const articleNumber = String(req.params.articleNumber ?? "");
    if (!placementOptionsByArticle.has(articleNumber)) {
      return res.status(404).json({ error: "Placeringsalternativ saknas. Öppna Flyttare och försök igen." });
    }
    return res.json({ placementOptions: placementOptionsByArticle.get(articleNumber) });
  }

  static async exportPdf(req, res, next) {
    try {
      const { analysis, run } = await AnalysisSnapshotService.getActive();
      const recommendations = AnalysisSnapshotService.derived(run.id, "relocations", () => buildRelocationViewModel(analysis, run.settings));
      const byArticle = new Map(recommendations.map((item) => [String(item.articleNumber), item]));
      const requested = String(req.body.articleNumbers ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      const selected = requested.map((articleNumber) => byArticle.get(articleNumber)).filter(Boolean);
      if (selected.length === 0) return res.status(400).send("Urvalet innehåller inga flyttkandidater.");
      const pdf = RelocationPdfReport.create({ recommendations: selected, analysis: run });
      const fileDate = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="trendtornado-flyttlista-${fileDate}.pdf"`);
      return res.send(pdf);
    } catch (error) {
      return next(error);
    }
  }
}
