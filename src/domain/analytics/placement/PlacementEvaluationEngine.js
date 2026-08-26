import {
  PlacementEvaluation,
} from "./PlacementEvaluation.js";

export class PlacementEvaluationEngine {
  static evaluate(
    articles,
    {
      frequencyWeight = 0.7,
      handlingWeight = 0.3,
    } = {},
  ) {
    if (!Array.isArray(articles)) {
      throw new TypeError(
        "Articles must be an array.",
      );
    }

    if (
      frequencyWeight < 0 ||
      handlingWeight < 0 ||
      Math.abs(
        frequencyWeight +
          handlingWeight -
          1,
      ) > Number.EPSILON
    ) {
      throw new Error(
        "Frequency weight and handling weight must sum to 1.",
      );
    }

    // --------------------------------------------------
    // Only articles with complete analysis data are
    // included in PlacementEvaluation v2.
    //
    // We still deliberately require exactly one
    // PICK location in this version.
    // --------------------------------------------------

    const eligibleArticles =
      articles.filter(
        (article) =>
          article.articleFound &&
          Number.isFinite(
            article.weightKg,
          ) &&
          article.weightKg >= 0 &&
          Number.isFinite(
            article.pickFrequency,
          ) &&
          article.pickFrequency >= 0 &&
          Number.isFinite(
            article.averageQuantityPerPick,
          ) &&
          article.averageQuantityPerPick >= 0 &&
          article
            .positionedPickLocations
            ?.length === 1 &&
          Number.isFinite(
            article
              .positionedPickLocations[0]
              .relativePickPosition,
          ),
      );

    // --------------------------------------------------
    // Compare articles only within the same PICK flow.
    // --------------------------------------------------

    const groupedByPickZone =
      this.#groupByPickZone(
        eligibleArticles,
      );

    const evaluations = [];

    for (
      const zoneArticles
      of groupedByPickZone.values()
    ) {
      // --------------------------------------------------
      // Calculate actual handling load.
      //
      // Example:
      //
      // 2 kg article
      // × 6 units per pick
      // = 12 kg handled per pick
      // --------------------------------------------------

      const handlingByArticle =
        new Map(
          zoneArticles.map(
            (article) => [
              article.articleNumber,
              article.weightKg *
                article.averageQuantityPerPick,
            ],
          ),
        );

      // --------------------------------------------------
      // Maximum values are calculated independently
      // within each PICK flow.
      // --------------------------------------------------

      const maxPickFrequency =
        Math.max(
          ...zoneArticles.map(
            (article) =>
              article.pickFrequency,
          ),
        );

      const maxHandledWeight =
        Math.max(
          ...zoneArticles.map(
            (article) =>
              handlingByArticle.get(
                article.articleNumber,
              ),
          ),
        );

      for (const article of zoneArticles) {
        const averageHandledWeightPerPick =
          handlingByArticle.get(
            article.articleNumber,
          );

        // --------------------------------------------------
        // Log normalization preserves the magnitude of the
        // difference between actual values without allowing
        // a few extreme articles to dominate everything.
        //
        // Example, if max frequency is 177:
        //
        // 177 picks -> 1.00
        //  39 picks -> ~0.71
        //   7 picks -> ~0.40
        // --------------------------------------------------

        const frequencyScore =
          this.#logNormalize(
            article.pickFrequency,
            maxPickFrequency,
          );

        const handlingScore =
          this.#logNormalize(
            averageHandledWeightPerPick,
            maxHandledWeight,
          );

        // --------------------------------------------------
        // V2 priority:
        //
        // 70 % actual pick frequency
        // 30 % handling load per pick
        // --------------------------------------------------

        const priorityScore =
          frequencyScore *
            frequencyWeight +
          handlingScore *
            handlingWeight;

        // --------------------------------------------------
        // For now we retain the V1 mapping between priority
        // and desired position.
        //
        // High priority -> early in the PICK flow.
        //
        // We can later replace this with priority ranking
        // without changing the rest of the architecture.
        // --------------------------------------------------

        const desiredPosition =
          1 - priorityScore;

        const currentPosition =
          article
            .positionedPickLocations[0]
            .relativePickPosition;

        // Positive gap:
        // article is later than its theoretical target.
        //
        // Negative gap:
        // article is earlier than its theoretical target.

        const placementGap =
          currentPosition -
          desiredPosition;

        evaluations.push(
          new PlacementEvaluation({
            articleNumber:
              article.articleNumber,

            frequencyScore,

            handlingScore,

            averageHandledWeightPerPick,

            priorityScore,

            currentPosition,

            desiredPosition,

            placementGap,
          }),
        );
      }
    }

    return evaluations;
  }

  // --------------------------------------------------
  // Group articles by PICK flow
  // --------------------------------------------------

  static #groupByPickZone(articles) {
    const groups = new Map();

    for (const article of articles) {
      const pickZoneType =
        article
          .positionedPickLocations[0]
          .location
          .pickZoneType;

      if (!groups.has(pickZoneType)) {
        groups.set(
          pickZoneType,
          [],
        );
      }

      groups
        .get(pickZoneType)
        .push(article);
    }

    return groups;
  }

  // --------------------------------------------------
  // Log normalization
  //
  // Returns a value between 0 and 1.
  //
  // value = maximum -> 1
  // value = 0       -> 0
  // --------------------------------------------------

  static #logNormalize(
    value,
    maximum,
  ) {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw new Error(
        "Value must be a non-negative number.",
      );
    }

    if (
      !Number.isFinite(maximum) ||
      maximum < 0
    ) {
      throw new Error(
        "Maximum must be a non-negative number.",
      );
    }

    if (maximum === 0) {
      return 0;
    }

    return (
      Math.log1p(value) /
      Math.log1p(maximum)
    );
  }
}