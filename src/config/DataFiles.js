
export const DataFiles = Object.freeze({
  // Add each non-overlapping week or month here. Files are
  // processed in this order; if a document occurs again,
  // the first file wins and the overlap is reported.
  history: Object.freeze([
    "data/imports/Artikeltransaktioner v31-25 20250728..20250803.csv",
    "data/imports/Artikeltransaktioner v32-25 20250804..20250810.csv",
    "data/imports/Artikeltransaktioner v33-25 20250811..20250817.csv",
    "data/imports/Artikeltransaktioner v34-25 20250818..20250824.csv",
    "data/imports/Artikeltransaktioner v35-25 20250825..20250831.csv",
    "data/imports/Artikeltransaktioner v36-25 20250901..20250907.csv",
    "data/imports/Artikeltransaktioner v37-25 20250908..20250914.csv",
    "data/imports/Artikeltransaktioner v38-25 20250915..20250921.csv",
    "data/imports/Artikeltransaktioner v39-25 20250922..20250928.csv",
    "data/imports/Artikeltransaktioner v40-25 20250929..20251005.csv",
    "data/imports/Artikeltransaktioner v41-25 20251006..20251012.csv",
    "data/imports/Artikeltransaktioner v42-25 20251013..20251019.csv",
    "data/imports/Artikeltransaktioner v43-25 20251020..20251026.csv",
    "data/imports/Artikeltransaktioner v44-25 20251027..20251102.csv",
    "data/imports/Artikeltransaktioner v45-25 20251103..20251109.csv",
    "data/imports/Artikeltransaktioner v46-25 20251110..20251116.csv",

    // "data/imports/Artikeltransaktioner v32-26 20260803..20260809.csv",
  ]),

  articles:
    "data/imports/Artikeldata.csv",

  locations:
    "data/imports/Lagerstruktur.csv",

  placements:
    "data/imports/ArtikelPlacering.csv",
});
