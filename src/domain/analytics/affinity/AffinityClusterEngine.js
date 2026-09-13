function pairKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function opportunityLabel(score) {
  if (score >= 0.8) return "VERY_HIGH";
  if (score >= 0.6) return "HIGH";
  if (score >= 0.4) return "MEDIUM";
  return "LOW";
}

export class AffinityClusterEngine {
  static analyze({
    historyRecords,
    profilesByArticle,
    bayCountByPickZone = new Map(),
    standardBayWidthMeters = 1,
    minimumCommonOrders = 10,
    minimumAffinity = 0.15,
    maximumClusterSize = 8,
  }) {
    if (!Array.isArray(historyRecords) || !(profilesByArticle instanceof Map)) {
      throw new TypeError("History records and article profiles are required.");
    }

    const documentsByArticle = new Map();
    const articlesByDocument = new Map();
    for (const record of historyRecords) {
      const profile = profilesByArticle.get(record.articleNumber);
      if (!profile?.pickZone || !Number.isFinite(profile.currentPosition)) continue;
      if (!documentsByArticle.has(record.articleNumber)) documentsByArticle.set(record.articleNumber, new Set());
      documentsByArticle.get(record.articleNumber).add(record.documentNumber);
      if (!articlesByDocument.has(record.documentNumber)) articlesByDocument.set(record.documentNumber, new Set());
      articlesByDocument.get(record.documentNumber).add(record.articleNumber);
    }

    const commonOrdersByPair = new Map();
    for (const [documentNumber, documentArticles] of articlesByDocument) {
      const byZone = new Map();
      for (const articleNumber of documentArticles) {
        const zone = profilesByArticle.get(articleNumber)?.pickZone;
        if (!zone) continue;
        if (!byZone.has(zone)) byZone.set(zone, []);
        byZone.get(zone).push(articleNumber);
      }
      for (const articles of byZone.values()) {
        for (let left = 0; left < articles.length; left += 1) {
          for (let right = left + 1; right < articles.length; right += 1) {
            const key = pairKey(articles[left], articles[right]);
            if (!commonOrdersByPair.has(key)) commonOrdersByPair.set(key, new Set());
            commonOrdersByPair.get(key).add(documentNumber);
          }
        }
      }
    }

    const eligiblePairs = [...commonOrdersByPair].filter(([, documents]) => documents.size >= minimumCommonOrders);
    const maximumCommonOrders = Math.max(1, ...eligiblePairs.map(([, documents]) => documents.size));
    const relations = eligiblePairs.map(([key, commonOrderDocuments]) => {
      const commonOrderCount = commonOrderDocuments.size;
      const [leftArticleNumber, rightArticleNumber] = key.split("\u0000");
      const left = profilesByArticle.get(leftArticleNumber);
      const right = profilesByArticle.get(rightArticleNumber);
      const leftOrders = documentsByArticle.get(leftArticleNumber)?.size ?? 0;
      const rightOrders = documentsByArticle.get(rightArticleNumber)?.size ?? 0;
      const affinity = commonOrderCount / Math.max(1, Math.min(leftOrders, rightOrders));
      const separation = Math.abs(left.currentPosition - right.currentPosition);
      const activityImportance = ((left.priorityScore ?? 0) + (right.priorityScore ?? 0)) / 2;
      const confidence = Math.log1p(commonOrderCount) / Math.log1p(maximumCommonOrders);
      // Geometric mean keeps all four signals mandatory while preserving a
      // useful 0–1 scale for the operational LOW–VERY_HIGH thresholds.
      const score = (affinity * activityImportance * separation * confidence) ** 0.25;
      const bayCount = bayCountByPickZone.get(left.pickZone) ?? 0;
      return {
        leftArticleNumber,
        rightArticleNumber,
        pickZone: left.pickZone,
        commonOrderCount,
        commonOrderDocuments,
        affinity,
        separation,
        estimatedDistanceMeters: separation * Math.max(0, bayCount - 1) * standardBayWidthMeters,
        activityImportance,
        confidence,
        opportunityScore: score,
        opportunityLevel: opportunityLabel(score),
      };
    }).filter((relation) => relation.affinity >= minimumAffinity)
      .toSorted((a, b) => b.opportunityScore - a.opportunityScore || b.commonOrderCount - a.commonOrderCount);

    const adjacency = new Map();
    for (const relation of relations) {
      for (const articleNumber of [relation.leftArticleNumber, relation.rightArticleNumber]) {
        if (!adjacency.has(articleNumber)) adjacency.set(articleNumber, []);
        adjacency.get(articleNumber).push(relation);
      }
    }

    const assigned = new Set();
    const clusters = [];
    for (const seed of relations) {
      if (assigned.has(seed.leftArticleNumber) && assigned.has(seed.rightArticleNumber)) continue;
      const members = new Set([seed.leftArticleNumber, seed.rightArticleNumber]);
      while (members.size < maximumClusterSize) {
        const candidates = [...members].flatMap((articleNumber) => adjacency.get(articleNumber) ?? [])
          .filter((relation) => !members.has(relation.leftArticleNumber) || !members.has(relation.rightArticleNumber))
          .toSorted((a, b) => b.opportunityScore - a.opportunityScore);
        const next = candidates[0];
        if (!next) break;
        members.add(next.leftArticleNumber);
        members.add(next.rightArticleNumber);
      }
      const articleNumbers = [...members].slice(0, maximumClusterSize);
      const memberSet = new Set(articleNumbers);
      const clusterRelations = relations.filter((relation) => (
        memberSet.has(relation.leftArticleNumber) && memberSet.has(relation.rightArticleNumber)
      ));
      const profiles = articleNumbers.map((articleNumber) => profilesByArticle.get(articleNumber));
      const positions = profiles.map((profile) => profile.currentPosition);
      const strongestRelation = clusterRelations[0] ?? seed;
      const clusterOrderDocuments = new Set(
        clusterRelations.flatMap((relation) => [...relation.commonOrderDocuments]),
      );
      const opportunityScore = clusterRelations.reduce((sum, relation) => sum + relation.opportunityScore, 0) / clusterRelations.length;
      const pickZone = seed.pickZone;
      const bayCount = bayCountByPickZone.get(pickZone) ?? 0;
      clusters.push({
        id: `${pickZone}-${clusters.length + 1}`,
        pickZone,
        articleNumbers,
        articles: profiles.toSorted((a, b) => a.currentPosition - b.currentPosition),
        relations: clusterRelations,
        relationCount: clusterRelations.length,
        commonOrderCount: clusterRelations.reduce((sum, relation) => sum + relation.commonOrderCount, 0),
        occurrenceCount: clusterOrderDocuments.size,
        averageAffinity: clusterRelations.reduce((sum, relation) => sum + relation.affinity, 0) / clusterRelations.length,
        spread: Math.max(...positions) - Math.min(...positions),
        estimatedSpreadMeters: (Math.max(...positions) - Math.min(...positions)) * Math.max(0, bayCount - 1) * standardBayWidthMeters,
        opportunityScore,
        opportunityLevel: opportunityLabel(opportunityScore),
        strongestRelation,
      });
      articleNumbers.forEach((articleNumber) => assigned.add(articleNumber));
    }

    clusters.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return {
      clusters,
      relations,
      diagnostics: {
        documents: articlesByDocument.size,
        crossZoneRelationsExcluded: true,
        minimumCommonOrders,
        minimumAffinity,
      },
    };
  }
}
