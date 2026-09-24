import { AffinityClusterEngine } from "../../domain/analytics/affinity/AffinityClusterEngine.js";
import { buildArticleCatalogViewModel } from "./buildArticleCatalogViewModel.js";

export function buildAffinityViewModel({ analysis, historyRecords, masterArticles, settings }) {
  const articles = buildArticleCatalogViewModel(analysis, masterArticles);
  const profilesByArticle = new Map(articles.filter((article) => (
    article.pickZone && Number.isFinite(article.currentPosition) && Number.isFinite(article.priorityScore)
  )).map((article) => [article.articleNumber, article]));
  const bayCountByPickZone = new Map();
  for (const bay of analysis.warehouse.bayFlow) {
    bayCountByPickZone.set(bay.pickZoneType, (bayCountByPickZone.get(bay.pickZoneType) ?? 0) + 1);
  }
  const result = AffinityClusterEngine.analyze({
    historyRecords,
    profilesByArticle,
    bayCountByPickZone,
    standardBayWidthMeters: settings.distance.standardBayWidthMeters,
  });
  const clusters = result.clusters.map((cluster) => {
    const { relations, articles: clusterArticles, associatedArticles: clusterAssociatedArticles, ...clusterSummary } = cluster;
    const { commonOrderDocuments, ...strongestRelation } = cluster.strongestRelation;
    const strongestLeft = profilesByArticle.get(cluster.strongestRelation.leftArticleNumber);
    const strongestRight = profilesByArticle.get(cluster.strongestRelation.rightArticleNumber);
    const classCounts = new Map();
    clusterArticles.forEach((article) => {
      const key = article.classification?.classification ?? "—";
      classCounts.set(key, (classCounts.get(key) ?? 0) + 1);
    });
    return {
      ...clusterSummary,
      strongestRelation,
      articles: clusterArticles.map((article) => ({
        articleNumber: article.articleNumber,
        name: article.name,
        currentPosition: article.currentPosition,
        currentLocation: article.currentLocation,
        physicalZone: physicalZone(article.currentLocation),
        flowSection: flowSection(article.currentPosition),
        classification: article.classification
          ? { classification: article.classification.classification }
          : null,
      })),
      associatedArticles: clusterAssociatedArticles.map((article) => ({
        articleNumber: article.articleNumber,
        name: article.name,
        currentPosition: article.currentPosition,
        currentLocation: article.currentLocation,
        physicalZone: physicalZone(article.currentLocation),
        flowSection: flowSection(article.currentPosition),
        classification: article.classification
          ? { classification: article.classification.classification }
          : null,
      })),
      name: `${strongestLeft?.name ?? cluster.strongestRelation.leftArticleNumber} + ${strongestRight?.name ?? cluster.strongestRelation.rightArticleNumber}`,
      classProfile: [...classCounts].toSorted((a, b) => b[1] - a[1]).map(([key, count]) => `${count} ${key}`).join(" · "),
      priorityReason: buildPriorityReason(cluster),
    };
  });
  const zones = [...new Set(clusters.map((cluster) => cluster.pickZone))].sort();
  return {
    clusters,
    zones,
    summary: {
      relations: result.relations.length,
      clusters: clusters.length,
      highOpportunity: clusters.filter((cluster) => cluster.opportunityScore >= 0.6).length,
      departments: zones.length,
    },
    diagnostics: result.diagnostics,
  };
}

function physicalZone(location) {
  const code = String(location ?? "");
  return /^\d{2}/.test(code) ? code.slice(0, 2) : "—";
}

function flowSection(position) {
  if (!Number.isFinite(position)) return "Okänd";
  if (position < 1 / 3) return "Början";
  if (position < 2 / 3) return "Mitten";
  return "Slutet";
}

function buildPriorityReason(cluster) {
  const reasons = [];
  if (cluster.averageAffinity >= 0.5) reasons.push("artiklarna samplockas ofta");
  else if (cluster.averageAffinity >= 0.25) reasons.push("tydligt samplockningsmönster");
  if (cluster.estimatedSpreadMeters >= 100) reasons.push("stor fysisk spridning");
  else if (cluster.estimatedSpreadMeters >= 40) reasons.push("artiklarna ligger utspridda");
  if (cluster.strongestRelation.activityImportance >= 0.6) reasons.push("hög plockaktivitet");
  if (cluster.strongestRelation.confidence >= 0.7) reasons.push("starkt historiskt underlag");
  return reasons.length > 0
    ? `${reasons.slice(0, 3).join(", ")}.`
    : "Kombinationen av samplockning, aktivitet och avstånd gör klustret relevant.";
}
