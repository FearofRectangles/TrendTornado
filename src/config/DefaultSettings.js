const defaultZoneMappings = [
  ...Array.from({ length: 9 }, (_, index) => ({ physicalZone: String(index + 1).padStart(2, "0"), temperatureZone: "KOL", pickZoneType: "KOLONIAL" })),
  ...Array.from({ length: 4 }, (_, index) => ({ physicalZone: String(index + 11).padStart(2, "0"), temperatureZone: "KYL", pickZoneType: "KYLT" })),
  ...Array.from({ length: 3 }, (_, index) => ({ physicalZone: String(index + 20).padStart(2, "0"), temperatureZone: "KYL", pickZoneType: "GRÖNSAKER" })),
  ...Array.from({ length: 10 }, (_, index) => ({ physicalZone: String(index + 30).padStart(2, "0"), temperatureZone: "FRY", pickZoneType: "FRYS" })),
];
const defaultPickAreas = [
  { name: "KOLONIAL", color: "#4e50af" },
  { name: "KYLT", color: "#4b8dd8" },
  { name: "GRÖNSAKER", color: "#4d9b5e" },
  { name: "FRYS", color: "#d74a43" },
];
const defaultArticleRules = ["7629", "7628", "134194", "134193", "99134"].map((articleNumber) => ({
  articleNumber,
  excludeFromAnalysis: true,
  hideRelocation: false,
}));

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
    beamThicknessCm: 12,
  }),
  classification: Object.freeze({
    abcAThreshold: 0.80,
    abcBThreshold: 0.95,
  }),
  articleRules: Object.freeze(defaultArticleRules.map(Object.freeze)),
  warehouse: Object.freeze({
    pickAreas: Object.freeze(defaultPickAreas.map(Object.freeze)),
    zoneMappings: Object.freeze(defaultZoneMappings.map(Object.freeze)),
  }),
});

export function validateSettings(settings) {
  const movementThreshold = Number(settings?.analysis?.movementThreshold);
  const frequencyWeight = Number(settings?.analysis?.frequencyWeight);
  const handlingWeight = Number(settings?.analysis?.handlingWeight);
  const lowPreferredKg = Number(settings?.ergonomics?.lowPreferredKg);
  const lowStronglyRecommendedKg = Number(settings?.ergonomics?.lowStronglyRecommendedKg);
  const standardBayWidthMeters = Number(settings?.distance?.standardBayWidthMeters);
  const beamThicknessCm = Number(settings?.distance?.beamThicknessCm);
  const abcAThreshold = Number(settings?.classification?.abcAThreshold);
  const abcBThreshold = Number(settings?.classification?.abcBThreshold);
  const zoneMappings = settings?.warehouse?.zoneMappings;
  const pickAreas = settings?.warehouse?.pickAreas;
  const articleRules = settings?.articleRules ?? [];

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
  if (!Number.isFinite(beamThicknessCm) || beamThicknessCm < 0 || beamThicknessCm > 50) {
    throw new Error("Balkhöjden måste vara mellan 0 och 50 centimeter.");
  }
  if (!Number.isFinite(abcAThreshold) || !Number.isFinite(abcBThreshold) || abcAThreshold <= 0 || abcAThreshold >= abcBThreshold || abcBThreshold >= 1) {
    throw new Error("ABC-gränserna måste vara stigande och ligga mellan 0 och 100 %.");
  }
  if (!Array.isArray(pickAreas) || pickAreas.length === 0) throw new Error("Minst ett plockområde måste vara konfigurerat.");
  const pickAreaNames = new Set();
  const normalizedPickAreas = pickAreas.map((area) => {
    const name = String(area.name ?? "").trim().toUpperCase();
    const color = String(area.color ?? "").trim().toLowerCase();
    if (!name || pickAreaNames.has(name)) throw new Error("Plockområden måste ha unika namn.");
    if (!/^#[0-9a-f]{6}$/.test(color)) throw new Error(`Färgen för ${name} måste anges som en giltig hexkod.`);
    pickAreaNames.add(name);
    return { name, color };
  });
  if (!Array.isArray(zoneMappings) || zoneMappings.length === 0) throw new Error("Minst en lagerzon måste vara konfigurerad.");
  const seenZones = new Set();
  const normalizedMappings = zoneMappings.map((mapping) => {
    const physicalZone = String(mapping.physicalZone ?? "").padStart(2, "0");
    const temperatureZone = String(mapping.temperatureZone ?? "").toUpperCase();
    const pickZoneType = String(mapping.pickZoneType ?? "").trim().toUpperCase();
    if (!/^\d{2}$/.test(physicalZone) || seenZones.has(physicalZone)) throw new Error("Fysiska lagerzoner måste vara unika tvåsiffriga koder.");
    if (!["KOL", "KYL", "FRY"].includes(temperatureZone)) throw new Error(`Temperaturzonen för ${physicalZone} är ogiltig.`);
    if (!pickZoneType) throw new Error(`Plockområdet för ${physicalZone} saknas.`);
    if (!pickAreaNames.has(pickZoneType)) throw new Error(`Plockområdet ${pickZoneType} för zon ${physicalZone} är inte definierat.`);
    seenZones.add(physicalZone);
    return { physicalZone, temperatureZone, pickZoneType };
  });
  if (!Array.isArray(articleRules)) throw new Error("Artikelundantag måste vara en lista.");
  const seenArticles = new Set();
  const normalizedArticleRules = articleRules.map((rule) => {
    const articleNumber = String(rule?.articleNumber ?? "").trim();
    if (!articleNumber || seenArticles.has(articleNumber)) throw new Error("Varje artikelundantag måste ha ett unikt artikelnummer.");
    const excludeFromAnalysis = Boolean(rule.excludeFromAnalysis);
    const hideRelocation = Boolean(rule.hideRelocation);
    if (!excludeFromAnalysis && !hideRelocation) throw new Error(`Välj minst en regel för artikel ${articleNumber}.`);
    seenArticles.add(articleNumber);
    return { articleNumber, excludeFromAnalysis, hideRelocation };
  });

  return {
    analysis: { movementThreshold, frequencyWeight, handlingWeight },
    ergonomics: { lowPreferredKg, lowStronglyRecommendedKg },
    distance: { standardBayWidthMeters, beamThicknessCm },
    classification: { abcAThreshold, abcBThreshold },
    articleRules: normalizedArticleRules,
    warehouse: { pickAreas: normalizedPickAreas, zoneMappings: normalizedMappings },
  };
}
