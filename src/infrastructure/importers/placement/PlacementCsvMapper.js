export function mapPlacementCsvRow(row) {
  const articleNumber = String(
    row.Varunummer ?? "",
  ).trim();

  const locationCode = String(
    row.Plats ?? "",
  ).trim();

  const status = String(
    row.Status ?? "",
  ).trim();

  const description = String(
    row.Beskrivning ?? "",
  ).trim();

  // Zonrubriker, tomma rader och andra rader som
  // inte beskriver en faktisk artikelplacering ignoreras.
  if (!articleNumber || !locationCode) {
    return null;
  }

  return {
    articleNumber,
    locationCode,
    status,
    description,
  };
}