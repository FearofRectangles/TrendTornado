import { Placement } from "../../domain/warehouse/placement/Placement.js";

export function buildPlacements(
  placementRecords,
  articles,
  locations,
) {
  if (!Array.isArray(placementRecords)) {
    throw new TypeError(
      "Placement records must be an array.",
    );
  }

  if (!Array.isArray(articles)) {
    throw new TypeError(
      "Articles must be an array.",
    );
  }

  if (!Array.isArray(locations)) {
    throw new TypeError(
      "Locations must be an array.",
    );
  }

  const articlesByNumber = new Map(
    articles.map((article) => [
      String(article.articleNumber).trim(),
      article,
    ]),
  );

  const locationsByCode = new Map(
    locations.map((location) => [
      String(location.locationCode).trim(),
      location,
    ]),
  );

  const placements = [];
  const missingArticles = [];
  const missingLocations = [];
  const rejectedPlacements = [];

  for (const record of placementRecords) {
    const articleNumber = String(
      record.articleNumber,
    ).trim();

    const locationCode = String(
      record.locationCode,
    ).trim();

    const article =
      articlesByNumber.get(articleNumber);

    const location =
      locationsByCode.get(locationCode);

    if (!article) {
      missingArticles.push(record);
      continue;
    }

    if (!location) {
      missingLocations.push(record);
      continue;
    }

    try {
      const placement = new Placement({
        article,
        location,
      });

      placements.push(placement);
    } catch (error) {
      rejectedPlacements.push({
        record,
        article,
        location,
        reason: error.message,
      });
    }
  }

  return {
    placements,
    missingArticles,
    missingLocations,
    rejectedPlacements,
  };
}