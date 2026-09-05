export class ProjectedLayoutBuilder {
  static build({
    historicalOrders,
    evaluations,
    movementThreshold = 0.20,
  }) {
    this.#assertHistoricalOrders(
      historicalOrders,
    );

    this.#assertEvaluations(
      evaluations,
    );

    this.#assertMovementThreshold(
      movementThreshold,
    );

    const evaluationByArticle =
      new Map();

    for (
      const evaluation
      of evaluations
    ) {
      const articleNumber =
        evaluation.articleNumber;

      if (!articleNumber) {
        continue;
      }

      evaluationByArticle.set(
        articleNumber,
        evaluation,
      );
    }

    return historicalOrders.map(
      (order) => ({
        ...order,

        picks:
          order.picks.map(
            (pick) =>
              this.#projectPick({
                pick,
                evaluation:
                  evaluationByArticle.get(
                    pick.articleNumber,
                  ),
                movementThreshold,
              }),
          ),
      }),
    );
  }

  static #projectPick({
    pick,
    evaluation,
    movementThreshold,
  }) {
    if (!evaluation) {
      return {
        ...pick,
      };
    }

    const placementGap =
      evaluation.placementGap;

    const desiredPosition =
      evaluation.desiredPosition;

    if (
      !Number.isFinite(
        placementGap,
      )
    ) {
      return {
        ...pick,
      };
    }

    const shouldMove =
      Math.abs(
        placementGap,
      ) >= movementThreshold;

    if (!shouldMove) {
      return {
        ...pick,
      };
    }

    this.#assertDesiredPosition(
      desiredPosition,
      pick.articleNumber,
    );

    return {
      ...pick,

      relativePosition:
        desiredPosition,
    };
  }

  static #assertHistoricalOrders(
    historicalOrders,
  ) {
    if (
      !Array.isArray(
        historicalOrders,
      )
    ) {
      throw new TypeError(
        "Historical orders must be an array.",
      );
    }

    for (
      const order
      of historicalOrders
    ) {
      if (
        !order ||
        typeof order !== "object"
      ) {
        throw new Error(
          "Every historical order must be an object.",
        );
      }

      if (
        !Array.isArray(
          order.picks,
        )
      ) {
        throw new Error(
          "Every historical order must contain picks.",
        );
      }
    }
  }

  static #assertEvaluations(
    evaluations,
  ) {
    if (
      !Array.isArray(
        evaluations,
      )
    ) {
      throw new TypeError(
        "Evaluations must be an array.",
      );
    }
  }

  static #assertMovementThreshold(
    movementThreshold,
  ) {
    if (
      !Number.isFinite(
        movementThreshold,
      ) ||
      movementThreshold < 0 ||
      movementThreshold > 1
    ) {
      throw new Error(
        "Movement threshold must be between 0 and 1.",
      );
    }
  }

  static #assertDesiredPosition(
    desiredPosition,
    articleNumber,
  ) {
    if (
      !Number.isFinite(
        desiredPosition,
      ) ||
      desiredPosition < 0 ||
      desiredPosition > 1
    ) {
      throw new Error(
        `Invalid desired position for article ${articleNumber}.`,
      );
    }
  }
}