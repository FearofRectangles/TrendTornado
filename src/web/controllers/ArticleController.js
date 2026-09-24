import { AnalysisSnapshotService } from "../../application/analysis/AnalysisSnapshotService.js";
import { buildArticleCatalogViewModel } from "../viewmodels/buildArticleCatalogViewModel.js";
import { PickAffinityEngine } from "../../domain/analytics/affinity/PickAffinityEngine.js";
import { SettingsRepository } from "../../infrastructure/settings/SettingsRepository.js";
import { ArticlePdfReport } from "../../infrastructure/reports/ArticlePdfReport.js";

async function loadCatalog() {
  const { data, analysis, run: activeAnalysis, runs: analysisRuns } = await AnalysisSnapshotService.getActive();
  const settings = await SettingsRepository.load();
  return {
    data,
    analysis,
    articles: AnalysisSnapshotService.derived(activeAnalysis.id, "article-catalog", () => buildArticleCatalogViewModel(analysis, data.articles, activeAnalysis.settings)),
    activeAnalysis,
    analysisRuns,
    pickAreaColors: Object.fromEntries(settings.warehouse.pickAreas.map((area) => [area.name, area.color])),
  };
}

function buildArticleDetail({ data, articles }, articleNumber) {
  const article = articles.find((item) => item.articleNumber === articleNumber);
  if (!article) return null;
  const articleByNumber = new Map(articles.map((item) => [item.articleNumber, item]));
  const affinityResult = PickAffinityEngine.analyze({
    historyRecords: data.historyRecords,
    articleNumber,
    minimumCommonOrders: 2,
    limit: 8,
  });
  return {
    article,
    affinity: {
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
    },
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
          physicalZones: unique(articles.map((article) => article.currentZone)),
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
      const detail = buildArticleDetail({ data, articles }, articleNumber);

      if (!detail) {
        res.status(404).send("Artikeln hittades inte.");
        return;
      }

      res.render("article-details", {
        title: detail.article.articleNumber,
        ...detail,
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

  static async detail(req, res, next) {
    try {
      const catalog = await loadCatalog();
      const articleNumber = String(req.params.articleNumber ?? "").trim();
      const detail = buildArticleDetail(catalog, articleNumber);
      if (!detail) return res.status(404).json({ error: "Artikeln hittades inte." });
      return res.json(detail);
    } catch (error) {
      return next(error);
    }
  }

  static async exportPdf(req, res, next) {
    try {
      const { articles, activeAnalysis } = await loadCatalog();
      const byArticle = new Map(articles.map((article) => [String(article.articleNumber), article]));
      const requested = String(req.body.articleNumbers ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      const selected = requested.map((articleNumber) => byArticle.get(articleNumber)).filter(Boolean);
      if (!selected.length) return res.status(400).send("Urvalet innehåller inga artiklar.");
      const pdf = ArticlePdfReport.create({ articles: selected, analysis: activeAnalysis });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="trendtornado-artikelregister-${new Date().toISOString().slice(0, 10)}.pdf"`);
      return res.send(pdf);
    } catch (error) { return next(error); }
  }
}
