function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export class PickTimeAnalysisEngine {
  static analyze({ movementRecords = [], positionedArticles = [], evaluations = [], movementThreshold = 0.2, pickSequence = [] }) {
    const positions = new Map();
    for (const article of positionedArticles) {
      const positioned = article.positionedPickLocations?.[0];
      if (!positioned || !Number.isFinite(positioned.relativePickPosition)) continue;
      positions.set(article.articleNumber, { current: positioned.relativePickPosition, pickZone: positioned.location.pickZoneType });
    }
    const observedPositions = new Map(pickSequence.map((entry) => [
      String(entry.location.locationCode),
      { current: entry.relativePickPosition, pickZone: entry.location.pickZoneType },
    ]));
    const positionForRecord = (record) => observedPositions.get(String(record.sourceLocation))
      ?? positions.get(String(record.articleNumber));
    const evaluationByArticle = new Map(evaluations.map((item) => [item.articleNumber, item]));
    const groups = new Map();
    for (const record of movementRecords) {
      const key = `${record.orderNumber}\u0000${record.worker}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    const transitions = [];
    for (const records of groups.values()) {
      const ordered = records.toSorted((a, b) => a.occurredAt - b.occurredAt);
      for (let index = 1; index < ordered.length; index += 1) {
        const from = ordered[index - 1]; const to = ordered[index];
        const seconds = (to.occurredAt - from.occurredAt) / 1000;
        if (seconds < 2 || seconds > 300) continue;
        const fromPosition = positionForRecord(from); const toPosition = positionForRecord(to);
        if (!fromPosition || !toPosition || fromPosition.pickZone !== toPosition.pickZone) continue;
        const currentSpan = Math.abs(toPosition.current - fromPosition.current);
        const optimized = (articleNumber, fallback) => {
          const evaluation = evaluationByArticle.get(articleNumber);
          return evaluation && Math.abs(evaluation.placementGap) >= movementThreshold ? evaluation.desiredPosition : fallback;
        };
        const optimizedSpan = Math.abs(optimized(to.articleNumber, toPosition.current) - optimized(from.articleNumber, fromPosition.current));
        transitions.push({ seconds, currentSpan, optimizedSpan, backtrack: toPosition.current < fromPosition.current });
      }
    }
    const regressionRows = transitions.filter((item) => item.currentSpan >= 0.02 && item.seconds <= 180);
    const meanX = regressionRows.reduce((sum, item) => sum + item.currentSpan, 0) / (regressionRows.length || 1);
    const meanY = regressionRows.reduce((sum, item) => sum + item.seconds, 0) / (regressionRows.length || 1);
    const covariance = regressionRows.reduce((sum, item) => sum + (item.currentSpan - meanX) * (item.seconds - meanY), 0);
    const variance = regressionRows.reduce((sum, item) => sum + (item.currentSpan - meanX) ** 2, 0);
    const secondsPerFullSpan = variance > 0 ? Math.max(0, Math.min(600, covariance / variance)) : 0;
    let firstTimestamp = Infinity; let lastTimestamp = -Infinity;
    for (const record of movementRecords) { const value = record.occurredAt.getTime(); if (value < firstTimestamp) firstTimestamp = value; if (value > lastTimestamp) lastTimestamp = value; }
    const observedWeeks = Number.isFinite(firstTimestamp) ? Math.max(1, (lastTimestamp - firstTimestamp) / (7 * 86400000) + 1 / 7) : 0;
    const currentSecondsPerWeek = transitions.reduce((sum, item) => sum + item.currentSpan * secondsPerFullSpan, 0) / (observedWeeks || 1);
    const optimizedSecondsPerWeek = transitions.reduce((sum, item) => sum + item.optimizedSpan * secondsPerFullSpan, 0) / (observedWeeks || 1);
    return {
      available: transitions.length >= 30 && secondsPerFullSpan > 0,
      records: movementRecords.length,
      orders: new Set(movementRecords.map((record) => record.orderNumber)).size,
      sequences: groups.size,
      transitions: transitions.length,
      coverage: movementRecords.length > 1 ? transitions.length / (movementRecords.length - 1) : 0,
      medianSecondsBetweenPicks: percentile(transitions.map((item) => item.seconds), 0.5),
      p90SecondsBetweenPicks: percentile(transitions.map((item) => item.seconds), 0.9),
      backtrackRate: transitions.length ? transitions.filter((item) => item.backtrack).length / transitions.length : 0,
      secondsPerFullSpan,
      currentSecondsPerWeek,
      optimizedSecondsPerWeek,
      estimatedSavedSecondsPerWeek: currentSecondsPerWeek - optimizedSecondsPerWeek,
    };
  }
}
