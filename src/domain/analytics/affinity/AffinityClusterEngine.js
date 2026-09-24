function pairKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function opportunityLabel(score) {
  if (score >= 0.8) return "VERY_HIGH";
  if (score >= 0.6) return "HIGH";
  if (score >= 0.4) return "MEDIUM";
  return "LOW";
}

function jaccard(left, right) {
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection / (left.size + right.size - intersection);
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
    minimumConnectionShare = 0.4,
    minimumInternalDensity = 0.35,
    duplicateSimilarity = 0.7,
    coreConnectionShare = 0.6,
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

    const relationByPair = new Map(relations.map((relation) => [
      pairKey(relation.leftArticleNumber, relation.rightArticleNumber),
      relation,
    ]));
    const provisionalBySignature = new Map();
    for (const seed of relations) {
      const members = new Set([seed.leftArticleNumber, seed.rightArticleNumber]);
      while (members.size < maximumClusterSize) {
        const candidateNumbers = new Set();
        for (const articleNumber of members) {
          for (const relation of adjacency.get(articleNumber) ?? []) {
            if (!members.has(relation.leftArticleNumber)) candidateNumbers.add(relation.leftArticleNumber);
            if (!members.has(relation.rightArticleNumber)) candidateNumbers.add(relation.rightArticleNumber);
          }
        }
        // A third member previously had to be connected to both seed articles.
        // That reduced most valid affinity communities to isolated pairs. Allow
        // one strong bridge while the density check below still prevents loose chains.
        const requiredConnections = Math.max(1, Math.ceil(members.size * minimumConnectionShare));
        const candidates = [...candidateNumbers].map((articleNumber) => {
          const connections = [...members]
            .map((member) => relationByPair.get(pairKey(articleNumber, member)))
            .filter(Boolean);
          return {
            articleNumber,
            connections,
            averageOpportunity: connections.reduce((sum, relation) => sum + relation.opportunityScore, 0) / Math.max(1, connections.length),
            averageAffinity: connections.reduce((sum, relation) => sum + relation.affinity, 0) / Math.max(1, connections.length),
          };
        }).filter((candidate) => (
          candidate.connections.length >= requiredConnections &&
          candidate.averageAffinity >= minimumAffinity
        )).toSorted((a, b) => b.averageOpportunity - a.averageOpportunity);
        if (candidates.length === 0) break;
        members.add(candidates[0].articleNumber);
      }
      const articleNumbers = [...members];
      const clusterRelations = [];
      for (let left = 0; left < articleNumbers.length; left += 1) {
        for (let right = left + 1; right < articleNumbers.length; right += 1) {
          const relation = relationByPair.get(pairKey(articleNumbers[left], articleNumbers[right]));
          if (relation) clusterRelations.push(relation);
        }
      }
      clusterRelations.sort((a, b) => b.opportunityScore - a.opportunityScore);
      const possibleRelations = articleNumbers.length * (articleNumbers.length - 1) / 2;
      const internalDensity = possibleRelations === 0 ? 0 : clusterRelations.length / possibleRelations;
      if (articleNumbers.length > 2 && internalDensity < minimumInternalDensity) continue;
      const profiles = articleNumbers.map((articleNumber) => profilesByArticle.get(articleNumber));
      const positions = profiles.map((profile) => profile.currentPosition);
      const strongestRelation = clusterRelations[0] ?? seed;
      const clusterOrderDocuments = new Set(
        clusterRelations.flatMap((relation) => [...relation.commonOrderDocuments]),
      );
      const opportunityScore = clusterRelations.reduce((sum, relation) => sum + relation.opportunityScore, 0) / clusterRelations.length;
      const pickZone = seed.pickZone;
      const bayCount = bayCountByPickZone.get(pickZone) ?? 0;
      const coreArticleNumbers = articleNumbers.filter((articleNumber) => {
        if (articleNumbers.length <= 2) return true;
        const connectionCount = articleNumbers.filter((other) => (
          other !== articleNumber && relationByPair.has(pairKey(articleNumber, other))
        )).length;
        // Three-article chains are meaningful communities even when the two
        // endpoints never occur together. Larger clusters still require a
        // strongly connected core; weaker members remain associated articles.
        const requiredCoreConnections = articleNumbers.length === 3
          ? 1
          : Math.ceil((articleNumbers.length - 1) * coreConnectionShare);
        return connectionCount >= requiredCoreConnections;
      });
      const effectiveCore = coreArticleNumbers.length >= 2 ? coreArticleNumbers : [seed.leftArticleNumber, seed.rightArticleNumber];
      const signature = [...effectiveCore].sort().join("\u0000");
      const candidateCluster = {
        pickZone,
        articleNumbers: effectiveCore,
        articles: effectiveCore.map((articleNumber) => profilesByArticle.get(articleNumber)).toSorted((a, b) => a.currentPosition - b.currentPosition),
        associatedArticleNumbers: articleNumbers.filter((articleNumber) => !effectiveCore.includes(articleNumber)),
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
        internalDensity,
      };
      const existing = provisionalBySignature.get(signature);
      if (!existing || candidateCluster.opportunityScore > existing.opportunityScore) {
        provisionalBySignature.set(signature, candidateCluster);
      }
    }

    const provisional = [...provisionalBySignature.values()].toSorted((a, b) => b.opportunityScore - a.opportunityScore);
    const clusters = [];
    const acceptedIndexesByArticle = new Map();
    const acceptedIndexByStrongestPair = new Map();
    for (const candidate of provisional) {
      const candidateCore = new Set(candidate.articleNumbers);
      const strongestPairKey = pairKey(
        candidate.strongestRelation.leftArticleNumber,
        candidate.strongestRelation.rightArticleNumber,
      );
      const comparableIndexes = new Set(candidate.articleNumbers.flatMap((articleNumber) => (
        acceptedIndexesByArticle.get(articleNumber) ?? []
      )));
      let duplicateIndex = acceptedIndexByStrongestPair.get(strongestPairKey) ?? null;
      for (const index of comparableIndexes) {
        if (duplicateIndex !== null) break;
        const existing = clusters[index];
        if (existing.pickZone !== candidate.pickZone) continue;
        if (jaccard(candidateCore, new Set(existing.articleNumbers)) >= duplicateSimilarity) {
          duplicateIndex = index;
          break;
        }
      }
      if (duplicateIndex !== null) {
        const existing = clusters[duplicateIndex];
        const extras = [...candidate.articleNumbers, ...candidate.associatedArticleNumbers]
          .filter((articleNumber) => !existing.articleNumbers.includes(articleNumber));
        existing.associatedArticleNumbers = [...new Set([...existing.associatedArticleNumbers, ...extras])]
          .slice(0, maximumClusterSize);
        continue;
      }
      const index = clusters.length;
      clusters.push(candidate);
      acceptedIndexByStrongestPair.set(strongestPairKey, index);
      candidate.articleNumbers.forEach((articleNumber) => {
        if (!acceptedIndexesByArticle.has(articleNumber)) acceptedIndexesByArticle.set(articleNumber, []);
        acceptedIndexesByArticle.get(articleNumber).push(index);
      });
    }

    for (const [index, cluster] of clusters.entries()) {
      cluster.id = `${cluster.pickZone}-${index + 1}`;
      cluster.associatedArticles = cluster.associatedArticleNumbers
        .map((articleNumber) => profilesByArticle.get(articleNumber))
        .filter(Boolean)
        .toSorted((a, b) => a.currentPosition - b.currentPosition);
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
        minimumConnectionShare,
        minimumInternalDensity,
        duplicateSimilarity,
        coreConnectionShare,
      },
    };
  }
}
