const WEIGHTS = Object.freeze({
  activity: 0.35,
  gap: 0.20,
  flowImpact: 0.20,
  feasibility: 0.10,
  confidence: 0.05,
  ergonomics: 0.10,
});

const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function feasibilityScore(options) {
  if (!options || options.dataQuality === "UNKNOWN") return 0.15;
  if (options.direct?.some((option) => option.withinTargetInterval)) return 1;
  if (options.direct?.length) return 0.85;
  if (options.swaps?.some((option) => option.withinTargetInterval)) return 0.75;
  if (options.swaps?.length) return 0.65;
  if (options.adjustments?.length) return 0.5;
  return 0.15;
}

function confidenceScore(classification) {
  const quality = { STRONG: 1, RELIABLE: 0.8, PRELIMINARY: 0.6, INSUFFICIENT: 0.3 }[classification?.quality] ?? 0.3;
  const stability = { X: 1, Y: 0.75, Z: 0.5 }[classification?.xyzClass] ?? 0.4;
  return (quality + stability) / 2;
}

function ergonomicScore(recommendation) {
  if (recommendation === "LOW_STRONGLY_RECOMMENDED") return 1;
  if (recommendation === "LOW_PREFERRED") return 0.65;
  return 0;
}

function label(score) {
  if (score >= 80) return "MYCKET HÖG";
  if (score >= 65) return "HÖG";
  if (score >= 40) return "MEDEL";
  return "LÅG";
}

export class RelocationUtilityEngine {
  static score(recommendations) {
    if (!Array.isArray(recommendations)) throw new TypeError("Recommendations must be an array.");
    return recommendations.map((recommendation) => {
      const direction = recommendation.placementGap >= 0 ? "EARLIER" : "LATER";
      const rawActivity = clamp(recommendation.frequencyScore);
      const activity = rawActivity;
      const gap = clamp(Math.abs(recommendation.placementGap));
      const flowImpact = (direction === "EARLIER" ? rawActivity : 1 - rawActivity) * gap;
      const feasibility = feasibilityScore(recommendation.placementOptions);
      const confidence = confidenceScore(recommendation.classification);
      const ergonomics = ergonomicScore(recommendation.ergonomicRecommendation);
      const components = { activity, gap, flowImpact, feasibility, confidence, ergonomics };
      const contributions = Object.fromEntries(Object.entries(components).map(([key, value]) => [
        key,
        Math.round(value * WEIGHTS[key] * 100),
      ]));
      const score = Math.round(Object.values(contributions).reduce((sum, value) => sum + value, 0));
      return {
        ...recommendation,
        utility: {
          score,
          label: label(score),
          directionModel: direction === "EARLIER" ? "FLOW_IMPROVEMENT" : "SPACE_RELEASE",
          components,
          contributions,
        },
      };
    }).toSorted((left, right) => (
      right.utility.score - left.utility.score ||
      Math.abs(right.placementGap) - Math.abs(left.placementGap)
    ));
  }
}

export { WEIGHTS };
