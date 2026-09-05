export class PickAffinityEngine {
  static analyze({
    historyRecords,
    articleNumber,
    minimumCommonOrders = 2,
    limit = 8,
  }) {
    if (!Array.isArray(historyRecords)) {
      throw new TypeError("History records must be an array.");
    }
    if (typeof articleNumber !== "string" || articleNumber.trim() === "") {
      throw new Error("Article number is required.");
    }
    if (!Number.isInteger(minimumCommonOrders) || minimumCommonOrders < 1) {
      throw new Error("Minimum common orders must be a positive integer.");
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Limit must be a positive integer.");
    }

    const selectedArticle = articleNumber.trim();
    const articlesByDocument = new Map();
    for (const record of historyRecords) {
      const documentNumber = String(record.documentNumber ?? "").trim();
      const recordArticle = String(record.articleNumber ?? "").trim();
      if (!documentNumber || !recordArticle) continue;
      if (!articlesByDocument.has(documentNumber)) {
        articlesByDocument.set(documentNumber, new Set());
      }
      articlesByDocument.get(documentNumber).add(recordArticle);
    }

    let selectedOrderCount = 0;
    const commonOrdersByArticle = new Map();
    for (const articles of articlesByDocument.values()) {
      if (!articles.has(selectedArticle)) continue;
      selectedOrderCount += 1;
      for (const partnerArticle of articles) {
        if (partnerArticle === selectedArticle) continue;
        commonOrdersByArticle.set(
          partnerArticle,
          (commonOrdersByArticle.get(partnerArticle) ?? 0) + 1,
        );
      }
    }

    const partners = [...commonOrdersByArticle]
      .filter(([, commonOrderCount]) => commonOrderCount >= minimumCommonOrders)
      .map(([partnerArticleNumber, commonOrderCount]) => ({
        articleNumber: partnerArticleNumber,
        commonOrderCount,
        affinity: selectedOrderCount === 0 ? 0 : commonOrderCount / selectedOrderCount,
      }))
      .toSorted((a, b) => (
        b.affinity - a.affinity ||
        b.commonOrderCount - a.commonOrderCount ||
        a.articleNumber.localeCompare(b.articleNumber, "sv", { numeric: true })
      ))
      .slice(0, limit);

    return {
      articleNumber: selectedArticle,
      selectedOrderCount,
      minimumCommonOrders,
      partners,
    };
  }
}
