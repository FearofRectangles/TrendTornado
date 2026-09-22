import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { buildArticleCatalogViewModel } from "../viewmodels/buildArticleCatalogViewModel.js";
import { PickAffinityEngine } from "../../domain/analytics/affinity/PickAffinityEngine.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";

async function loadCatalog() {
  const { data, analysis, run: activeAnalysis, runs: analysisRuns } = await AnalysisSnapshotService.getActive();
  const settings = await SettingsRepository.load();
  return {
    data,
    analysis,
    articles: AnalysisSnapshotService.derived(activeAnalysis.id, "article-catalog", () => buildArticleCatalogViewModel(analysis, data.articles)),
    activeAnalysis,
    analysisRuns,
    pickAreaColors: Object.fromEntries(settings.warehouse.pickAreas.map((area) => [area.name, area.color])),
  };
}

export class ArticleController {
  static async index(req, res, next) {
    try {
      const { data, analysis, articles, activeAnalysis, analysisRuns, pickAreaColors } = await loadCatalog();
      const unique = (values) => [...new Set(values.filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "sv", { numeric: true }));

      res.render("articles", {
        title: "Artiklar",
        articles,
        period: analysis.period,
        importSummary: data.importSummary,
        activeAnalysis,
        analysisRuns,
        pickAreaColors,
        filters: {
          pickZones: unique(articles.map((article) => article.pickZone)),
          temperatureZones: unique(articles.map((article) => article.temperatureZone)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async show(req, res, next) {
    try {
      const { data, analysis, articles, activeAnalysis, analysisRuns, pickAreaColors } = await loadCatalog();
      const articleNumber = String(req.params.articleNumber ?? "").trim();
      const article = articles.find((item) => item.articleNumber === articleNumber);

      if (!article) {
        res.status(404).send("Artikeln hittades inte.");
        return;
      }

      const articleByNumber = new Map(
        articles.map((item) => [item.articleNumber, item]),
      );
      const affinityResult = PickAffinityEngine.analyze({
        historyRecords: data.historyRecords,
        articleNumber,
        minimumCommonOrders: 2,
        limit: 8,
      });
      const affinity = {
        ...affinityResult,
        partners: affinityResult.partners.map((partner) => {
          const partnerArticle = articleByNumber.get(partner.articleNumber);
          return {
            ...partner,
            name: partnerArticle?.name ?? "Saknas i artikelregistret",
            pickZone: partnerArticle?.pickZone ?? null,
            available: partnerArticle !== undefined,
          };
        }),
      };

      res.render("article-details", {
        title: article.articleNumber,
        article,
        affinity,
        period: analysis.period,
        importSummary: data.importSummary,
        activeAnalysis,
        analysisRuns,
        pickAreaColors,
      });
    } catch (error) {
      next(error);
    }
  }
}
