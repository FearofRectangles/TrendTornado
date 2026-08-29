import {
  OrderSimulation,
} from "./OrderSimulation.js";


export class OrderSimulationEngine {
  static simulate({
    documentNumber,
    picks,
  }) {
    if (
      typeof documentNumber !==
        "string" ||
      documentNumber.trim() === ""
    ) {
      throw new Error(
        "Document number is required.",
      );
    }

    if (!Array.isArray(picks)) {
      throw new TypeError(
        "Picks must be an array.",
      );
    }

    if (picks.length === 0) {
      throw new Error(
        "At least one pick is required.",
      );
    }


    // --------------------------------------------------
    // Validate and enrich picks
    // --------------------------------------------------

    const enrichedPicks =
      picks.map((pick) => {
        this.#assertPick(pick);

        return {
          ...pick,

          handledWeight:
            pick.weightKg *
            pick.pickedQuantity,
        };
      });


    // --------------------------------------------------
    // Sort according to PICK flow
    // --------------------------------------------------

    const orderedPicks =
      enrichedPicks.toSorted(
        (a, b) =>
          a.relativePosition -
          b.relativePosition,
      );


    // --------------------------------------------------
    // Pick span
    // --------------------------------------------------

    const firstPosition =
      orderedPicks[0]
        .relativePosition;

    const lastPosition =
      orderedPicks[
        orderedPicks.length - 1
      ].relativePosition;

    const pickSpan =
      lastPosition -
      firstPosition;


    // --------------------------------------------------
    // Weight ordering
    //
    // Every pair of picks with different handled weight
    // is comparable.
    //
    // Correct:
    // heavier handled load appears before lighter load.
    //
    // Equal weights are ignored because neither order
    // is better than the other.
    // --------------------------------------------------

    let correctlyOrderedPairs = 0;
    let comparablePairs = 0;

    for (
      let i = 0;
      i < orderedPicks.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < orderedPicks.length;
        j++
      ) {
        const earlier =
          orderedPicks[i];

        const later =
          orderedPicks[j];

        if (
          earlier.handledWeight ===
          later.handledWeight
        ) {
          continue;
        }

        comparablePairs++;

        if (
          earlier.handledWeight >
          later.handledWeight
        ) {
          correctlyOrderedPairs++;
        }
      }
    }


    // --------------------------------------------------
    // Score
    //
    // If no pair is comparable, the order has no
    // meaningful weight-order problem. We treat it as
    // perfectly ordered rather than penalizing it.
    // --------------------------------------------------

    const weightOrderScore =
      comparablePairs === 0
        ? 1
        : correctlyOrderedPairs /
          comparablePairs;


    return new OrderSimulation({
      documentNumber,

      pickCount:
        orderedPicks.length,

      firstPosition,

      lastPosition,

      pickSpan,

      weightOrderScore,

      correctlyOrderedPairs,

      comparablePairs,
    });
  }


  static #assertPick(pick) {
    if (
      !pick ||
      typeof pick !==
        "object"
    ) {
      throw new Error(
        "Every pick must be an object.",
      );
    }

    if (
      typeof pick.articleNumber !==
        "string" ||
      pick.articleNumber.trim() === ""
    ) {
      throw new Error(
        "Article number is required for every pick.",
      );
    }

    if (
      !Number.isFinite(
        pick.pickedQuantity,
      ) ||
      pick.pickedQuantity <= 0
    ) {
      throw new Error(
        "Picked quantity must be greater than zero.",
      );
    }

    if (
      !Number.isFinite(
        pick.weightKg,
      ) ||
      pick.weightKg < 0
    ) {
      throw new Error(
        "Weight must be a non-negative number.",
      );
    }

    if (
      !Number.isFinite(
        pick.relativePosition,
      ) ||
      pick.relativePosition < 0 ||
      pick.relativePosition > 1
    ) {
      throw new Error(
        "Relative position must be between 0 and 1.",
      );
    }
  }
}