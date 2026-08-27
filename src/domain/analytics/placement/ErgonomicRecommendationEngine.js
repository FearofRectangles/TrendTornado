import {
  ErgonomicRecommendation,
} from "./ErgonomicRecommendation.js";

export class ErgonomicRecommendationEngine {
  static evaluate({
    weightKg,
    averageHandledWeightPerPick,
  }) {
    if (
      !Number.isFinite(weightKg) ||
      weightKg < 0
    ) {
      throw new Error(
        "Weight must be a non-negative number.",
      );
    }

    if (
      !Number.isFinite(
        averageHandledWeightPerPick,
      ) ||
      averageHandledWeightPerPick < 0
    ) {
      throw new Error(
        "Average handled weight per pick must be a non-negative number.",
      );
    }

    // --------------------------------------------------
    // Strong recommendation for a low placement.
    //
    // Either:
    // - the individual unit is heavy
    // - or the normal handling load per pick is high
    // --------------------------------------------------

    if (
      weightKg >= 8 ||
      averageHandledWeightPerPick >= 8
    ) {
      return {
        recommendation:
          ErgonomicRecommendation
            .LOW_STRONGLY_RECOMMENDED,

        reason:
          this.#buildReason({
            weightKg,
            averageHandledWeightPerPick,
            strong: true,
          }),
      };
    }

    // --------------------------------------------------
    // Moderate recommendation for a low placement.
    // --------------------------------------------------

    if (
      weightKg >= 4 ||
      averageHandledWeightPerPick >= 4
    ) {
      return {
        recommendation:
          ErgonomicRecommendation
            .LOW_PREFERRED,

        reason:
          this.#buildReason({
            weightKg,
            averageHandledWeightPerPick,
            strong: false,
          }),
      };
    }

    // --------------------------------------------------
    // No particular need for a low placement.
    // Higher shelves are reasonable alternatives.
    // --------------------------------------------------

    return {
      recommendation:
        ErgonomicRecommendation.HIGH_OK,

      reason:
        "Handled weight is low enough for flexible shelf placement.",
    };
  }

  static #buildReason({
    weightKg,
    averageHandledWeightPerPick,
    strong,
  }) {
    const prefix = strong
      ? "Low placement strongly recommended"
      : "Low placement preferred";

    return (
      `${prefix}: ` +
      `${weightKg.toFixed(2)} kg per unit, ` +
      `${averageHandledWeightPerPick.toFixed(2)} kg average handled per pick.`
    );
  }
}