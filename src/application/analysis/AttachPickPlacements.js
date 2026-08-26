export function attachPickPlacements(
  articleStatistics,
  pickPlacements,
) {
  const placementsByArticle = new Map();

  for (const placement of pickPlacements) {
    const articleNumber = placement.article.articleNumber;

    if (!placementsByArticle.has(articleNumber)) {
      placementsByArticle.set(articleNumber, []);
    }

    placementsByArticle
      .get(articleNumber)
      .push(placement.location);
  }

  return articleStatistics.map((statistics) => ({
    ...statistics,
    pickLocations:
      placementsByArticle.get(statistics.articleNumber) ?? [],
  }));
}