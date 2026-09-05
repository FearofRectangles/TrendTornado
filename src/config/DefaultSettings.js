export const DEFAULT_SETTINGS = Object.freeze({
  analysis: Object.freeze({
    movementThreshold: 0.20,
    frequencyWeight: 0.70,
    handlingWeight: 0.30,
  }),
  ergonomics: Object.freeze({
    lowPreferredKg: 4,
    lowStronglyRecommendedKg: 8,
  }),
  distance: Object.freeze({
    standardBayWidthMeters: 1,
  }),
});

export function validateSettings(settings) {
  const movementThreshold = Number(settings?.analysis?.movementThreshold);
  const frequencyWeight = Number(settings?.analysis?.frequencyWeight);
  const handlingWeight = Number(settings?.analysis?.handlingWeight);
  const lowPreferredKg = Number(settings?.ergonomics?.lowPreferredKg);
  const lowStronglyRecommendedKg = Number(settings?.ergonomics?.lowStronglyRecommendedKg);
  const standardBayWidthMeters = Number(settings?.distance?.standardBayWidthMeters);

  if (!Number.isFinite(movementThreshold) || movementThreshold < 0 || movementThreshold > 1) {
    throw new Error("Flyttgränsen måste vara mellan 0 och 100 %.");
  }
  if (!Number.isFinite(frequencyWeight) || !Number.isFinite(handlingWeight) || frequencyWeight < 0 || handlingWeight < 0 || Math.abs(frequencyWeight + handlingWeight - 1) > 0.000001) {
    throw new Error("Prioriteringsvikterna måste tillsammans bli 100 %.");
  }
  if (!Number.isFinite(lowPreferredKg) || lowPreferredKg < 0 || !Number.isFinite(lowStronglyRecommendedKg) || lowStronglyRecommendedKg < lowPreferredKg) {
    throw new Error("Ergonomigränserna är ogiltiga. Stark rekommendation måste vara minst lika hög som föredragen låg placering.");
  }
  if (!Number.isFinite(standardBayWidthMeters) || standardBayWidthMeters <= 0 || standardBayWidthMeters > 20) {
    throw new Error("Standardfackets bredd måste vara större än 0 och högst 20 meter.");
  }

  return {
    analysis: { movementThreshold, frequencyWeight, handlingWeight },
    ergonomics: { lowPreferredKg, lowStronglyRecommendedKg },
    distance: { standardBayWidthMeters },
  };
}
