function weekKey(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function classifyQuality(observedWeeks) {
  if (observedWeeks < 4) return "INSUFFICIENT";
  if (observedWeeks < 8) return "PRELIMINARY";
  if (observedWeeks < 13) return "RELIABLE";
  return "STRONG";
}

function classifyXyz({ activeShare, coefficientOfVariation }) {
  if (activeShare >= 0.8 && coefficientOfVariation <= 0.5) return "X";
  if (activeShare >= 0.5 && coefficientOfVariation <= 1) return "Y";
  return "Z";
}

export class AbcXyzClassificationEngine {
  static analyze(historyRecords, { aThreshold = 0.8, bThreshold = 0.95 } = {}) {
    if (!Array.isArray(historyRecords)) throw new TypeError("History records must be an array.");
    if (!(aThreshold > 0 && aThreshold < bThreshold && bThreshold < 1)) {
      throw new Error("ABC thresholds must satisfy 0 < A < B < 1.");
    }

    const observedWeekKeys = [...new Set(historyRecords.map((record) => weekKey(record.postingDate)))].sort();
    const documentsByArticle = new Map();
    const documentsByArticleWeek = new Map();

    for (const record of historyRecords) {
      if (!documentsByArticle.has(record.articleNumber)) documentsByArticle.set(record.articleNumber, new Set());
      documentsByArticle.get(record.articleNumber).add(record.documentNumber);

      if (!documentsByArticleWeek.has(record.articleNumber)) documentsByArticleWeek.set(record.articleNumber, new Map());
      const byWeek = documentsByArticleWeek.get(record.articleNumber);
      const key = weekKey(record.postingDate);
      if (!byWeek.has(key)) byWeek.set(key, new Set());
      byWeek.get(key).add(record.documentNumber);
    }

    const ranked = [...documentsByArticle.entries()]
      .map(([articleNumber, documents]) => ({ articleNumber, pickStops: documents.size }))
      .sort((a, b) => b.pickStops - a.pickStops || a.articleNumber.localeCompare(b.articleNumber, "sv", { numeric: true }));
    const totalPickStops = ranked.reduce((sum, item) => sum + item.pickStops, 0);
    const quality = classifyQuality(observedWeekKeys.length);
    let cumulativeStops = 0;
    const classifications = new Map();

    for (const item of ranked) {
      const shareBefore = totalPickStops === 0 ? 0 : cumulativeStops / totalPickStops;
      const abcClass = shareBefore < aThreshold ? "A" : shareBefore < bThreshold ? "B" : "C";
      cumulativeStops += item.pickStops;
      const weeklyPickStops = observedWeekKeys.map((key) => documentsByArticleWeek.get(item.articleNumber)?.get(key)?.size ?? 0);
      const activeWeeks = weeklyPickStops.filter((value) => value > 0).length;
      const mean = weeklyPickStops.length === 0 ? 0 : weeklyPickStops.reduce((sum, value) => sum + value, 0) / weeklyPickStops.length;
      const variance = weeklyPickStops.length === 0 ? 0 : weeklyPickStops.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / weeklyPickStops.length;
      const coefficientOfVariation = mean === 0 ? null : Math.sqrt(variance) / mean;
      const activeShare = observedWeekKeys.length === 0 ? 0 : activeWeeks / observedWeekKeys.length;
      const xyzClass = quality === "INSUFFICIENT" ? null : classifyXyz({ activeShare, coefficientOfVariation });

      classifications.set(item.articleNumber, {
        articleNumber: item.articleNumber,
        classification: `${abcClass}${xyzClass ?? "–"}`,
        abcClass,
        xyzClass,
        quality,
        abc: {
          pickStops: item.pickStops,
          activityShare: totalPickStops === 0 ? 0 : item.pickStops / totalPickStops,
          cumulativeShare: totalPickStops === 0 ? 0 : cumulativeStops / totalPickStops,
        },
        xyz: {
          observedWeeks: observedWeekKeys.length,
          activeWeeks,
          activeShare,
          meanWeeklyPickStops: mean,
          coefficientOfVariation,
          weeklyPickStops,
        },
      });
    }

    return {
      byArticle: classifications,
      observedWeeks: observedWeekKeys,
      observedWeekCount: observedWeekKeys.length,
      quality,
      totalPickStops,
      thresholds: { a: aThreshold, b: bThreshold },
    };
  }
}

export { weekKey };
