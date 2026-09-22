export function enrichArticleStatistics(statistics, articles) {
  if (!Array.isArray(statistics)) {
    throw new TypeError("Statistics must be an array.");
  }

  if (!Array.isArray(articles)) {
    throw new TypeError("Articles must be an array.");
  }

  const articlesByNumber = new Map(
    articles.map((article) => [
      String(article.articleNumber).trim(),
      article,
    ]),
  );

  return statistics.map((stats) => {
    const articleNumber = String(
      stats.articleNumber,
    ).trim();

    const article = articlesByNumber.get(
      articleNumber,
    );

    return {
      articleNumber,

      name: article?.name ?? null,
      weightKg: article?.weightKg ?? null,
      temperatureZone:
        article?.temperatureZone ?? null,
      category: article?.category ?? null,
      baseUnit: article?.baseUnit ?? null,
      heightCm: article?.heightCm ?? null,
      widthCm: article?.widthCm ?? null,
      depthCm: article?.depthCm ?? null,

      pickFrequency: stats.pickFrequency,
      pickedQuantity: stats.pickedQuantity,
      averageQuantityPerPick:
        stats.averageQuantityPerPick,

      articleFound: article !== undefined,
    };
  });
}
