export class OrderSimulation {
  constructor({
    documentNumber,
    pickCount,
    firstPosition,
    lastPosition,
    pickSpan,
    weightOrderScore,
    correctlyOrderedPairs,
    comparablePairs,
  }) {
    this.#assertDocumentNumber(
      documentNumber,
    );

    this.#assertNonNegativeInteger(
      pickCount,
      "Pick count",
    );

    this.#assertPosition(
      firstPosition,
      "First position",
    );

    this.#assertPosition(
      lastPosition,
      "Last position",
    );

    this.#assertPosition(
      pickSpan,
      "Pick span",
    );

    this.#assertPosition(
      weightOrderScore,
      "Weight order score",
    );

    this.#assertNonNegativeInteger(
      correctlyOrderedPairs,
      "Correctly ordered pairs",
    );

    this.#assertNonNegativeInteger(
      comparablePairs,
      "Comparable pairs",
    );

    if (
      correctlyOrderedPairs >
      comparablePairs
    ) {
      throw new Error(
        "Correctly ordered pairs cannot exceed comparable pairs.",
      );
    }

    if (
      firstPosition >
      lastPosition
    ) {
      throw new Error(
        "First position cannot be after last position.",
      );
    }

    this.documentNumber =
      documentNumber;

    this.pickCount =
      pickCount;

    this.firstPosition =
      firstPosition;

    this.lastPosition =
      lastPosition;

    this.pickSpan =
      pickSpan;

    this.weightOrderScore =
      weightOrderScore;

    this.correctlyOrderedPairs =
      correctlyOrderedPairs;

    this.comparablePairs =
      comparablePairs;
  }


  #assertDocumentNumber(
    documentNumber,
  ) {
    if (
      typeof documentNumber !==
        "string" ||
      documentNumber.trim() === ""
    ) {
      throw new Error(
        "Document number is required.",
      );
    }
  }


  #assertNonNegativeInteger(
    value,
    name,
  ) {
    if (
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new Error(
        `${name} must be a non-negative integer.`,
      );
    }
  }


  #assertPosition(
    value,
    name,
  ) {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error(
        `${name} must be between 0 and 1.`,
      );
    }
  }
}