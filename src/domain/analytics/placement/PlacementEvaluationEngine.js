import {
  PlacementEvaluation,
} from "./PlacementEvaluation.js";

export class PlacementEvaluationEngine {
  static evaluate(
    articles,
    {
      frequencyWeight = 0.7,
      articleWeight = 0.3,
    } = {},
  ) {
    if (!Array.isArray(articles)) {
      throw new TypeError(
        "Articles must be an array.",
      );
    }

    if (
      frequencyWeight < 0 ||
      articleWeight < 0 ||
      Math.abs(
        frequencyWeight +
          articleWeight -
          1,
      ) > Number.EPSILON
    ) {
      throw new Error(
        "Frequency weight and article weight must sum to 1.",
      );
    }

    // --------------------------------------------------
    // Only evaluate articles for which we have enough
    // information to make a meaningful comparison.
    //
    // V1 deliberately requires exactly one PICK location.
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
          article.positionedPickLocations
            ?.length === 1 &&
          Number.isFinite(
            article
              .positionedPickLocations[0]
              .relativePickPosition,
          ),
      );

    // --------------------------------------------------
    // Articles must only be compared with articles
    // belonging to the same PICK flow.
    // --------------------------------------------------

    const groupedByPickZone =
      this.#groupByPickZone(
        eligibleArticles,
      );

    const evaluations = [];

    // --------------------------------------------------
    // Evaluate each PICK zone independently
    // --------------------------------------------------

    for (
      const zoneArticles
      of groupedByPickZone.values()
    ) {
      const frequencyScores =
        this.#buildRankScores(
          zoneArticles,
          (article) =>
            article.pickFrequency,
        );

      const weightScores =
        this.#buildRankScores(
          zoneArticles,
          (article) =>
            article.weightKg,
        );

      for (const article of zoneArticles) {
        const frequencyScore =
          frequencyScores.get(
            article.articleNumber,
          );

        const weightScore =
          weightScores.get(
            article.articleNumber,
          );

        // --------------------------------------------------
        // Higher priority means that the article should
        // generally appear earlier in the PICK flow.
        //
        // V1:
        // 70 % pick frequency
        // 30 % article weight
        // --------------------------------------------------

        const priorityScore =
          frequencyScore *
            frequencyWeight +
          weightScore *
            articleWeight;

        // --------------------------------------------------
        // Position scale:
        //
        // 0 = beginning of PICK flow
        // 1 = end of PICK flow
        //
        // High priority therefore produces a low desired
        // position.
        // --------------------------------------------------

        const desiredPosition =
          1 - priorityScore;

        const currentPosition =
          article
            .positionedPickLocations[0]
            .relativePickPosition;

        // --------------------------------------------------
        // Positive:
        // article is located later than desired.
        //
        // Negative:
        // article is located earlier than desired.
        // --------------------------------------------------

        const placementGap =
          currentPosition -
          desiredPosition;

        evaluations.push(
          new PlacementEvaluation({
            articleNumber:
              article.articleNumber,

            frequencyScore,
            weightScore,
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
  // Group articles by PICK zone
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
  // Rank score
  //
  // Lowest value  -> close to 0
  // Highest value -> close to 1
  //
  // Equal values receive the same score.
  // --------------------------------------------------

  static #buildRankScores(
    articles,
    getValue,
  ) {
    const sorted = [...articles].sort(
      (a, b) =>
        getValue(a) -
        getValue(b),
    );

    const scores = new Map();

    if (sorted.length === 0) {
      return scores;
    }

    if (sorted.length === 1) {
      scores.set(
        sorted[0].articleNumber,
        1,
      );

      return scores;
    }

    let index = 0;

    while (index < sorted.length) {
      const value =
        getValue(sorted[index]);

      let endIndex = index;

      // Find all articles with the same value.
      while (
        endIndex + 1 <
          sorted.length &&
        getValue(
          sorted[endIndex + 1],
        ) === value
      ) {
        endIndex++;
      }

      // Give ties the average rank of the group.
      const averageIndex =
        (index + endIndex) / 2;

      const score =
        averageIndex /
        (sorted.length - 1);

      for (
        let i = index;
        i <= endIndex;
        i++
      ) {
        scores.set(
          sorted[i].articleNumber,
          score,
        );
      }

      index = endIndex + 1;
    }

    return scores;
  }
}