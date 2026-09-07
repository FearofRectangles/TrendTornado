
export const DataFiles = Object.freeze({
  // Add each non-overlapping week or month here. Files are
  // processed in this order; if a document occurs again,
  // the first file wins and the overlap is reported.
  history: Object.freeze([
    "data/imports/Artikeltransaktioner v35-25 20260825..20260831.csv",
    "data/imports/Artikeltransaktioner v32-26 20260803..20260809.csv",
  ]),

  articles:
    "data/imports/Artikeldata.csv",

  locations:
    "data/imports/LagerStruktur.csv",

  placements:
    "data/imports/ArtikelPlacering.csv",
});
