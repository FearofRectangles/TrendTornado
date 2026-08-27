export class PlacementDiagnostics {
  static analyze(evaluations) {
    if (!Array.isArray(evaluations)) {
      throw new TypeError(
        "Evaluations must be an array.",
      );
    }

    if (evaluations.length === 0) {
      return {
        count: 0,
        frequencyScore: null,
        handlingScore: null,
        priorityScore: null,
      };
    }

    return {
      count: evaluations.length,

      frequencyScore:
        this.#buildDistribution(
          evaluations.map(
            (evaluation) =>
              evaluation.frequencyScore,
          ),
        ),

      handlingScore:
        this.#buildDistribution(
          evaluations.map(
            (evaluation) =>
              evaluation.handlingScore,
          ),
        ),

      priorityScore:
        this.#buildDistribution(
          evaluations.map(
            (evaluation) =>
              evaluation.priorityScore,
          ),
        ),
    };
  }

  static #buildDistribution(values) {
    const sorted = [...values].sort(
      (a, b) => a - b,
    );

    return {
      min: sorted[0],

      p10:
        this.#percentile(
          sorted,
          0.10,
        ),

      p25:
        this.#percentile(
          sorted,
          0.25,
        ),

      median:
        this.#percentile(
          sorted,
          0.50,
        ),

      p75:
        this.#percentile(
          sorted,
          0.75,
        ),

      p90:
        this.#percentile(
          sorted,
          0.90,
        ),

      max:
        sorted[
          sorted.length - 1
        ],
    };
  }

  static #percentile(
    sortedValues,
    percentile,
  ) {
    if (sortedValues.length === 1) {
      return sortedValues[0];
    }

    const index =
      percentile *
      (sortedValues.length - 1);

    const lowerIndex =
      Math.floor(index);

    const upperIndex =
      Math.ceil(index);

    if (lowerIndex === upperIndex) {
      return sortedValues[
        lowerIndex
      ];
    }

    const fraction =
      index - lowerIndex;

    const lowerValue =
      sortedValues[lowerIndex];

    const upperValue =
      sortedValues[upperIndex];

    return (
      lowerValue +
      (upperValue - lowerValue) *
        fraction
    );
  }
}