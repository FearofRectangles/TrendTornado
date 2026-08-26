import { readCsvFile } from "../src/infrastructure/csv/CsvReader.js";

import {
  mapArticleCsvRow,
} from "../src/infrastructure/importers/article/ArticleCsvMapper.js";

import {
  mapLocationCsvRow,
} from "../src/infrastructure/importers/location/LocationCsvMapper.js";

import {
  mapPlacementCsvRow,
} from "../src/infrastructure/importers/placement/PlacementCsvMapper.js";

import {
  buildPlacements,
} from "../src/application/warehouse/BuildPlacements.js";

import {
  LocationPurpose,
} from "../src/domain/shared/LocationPurpose.js";


// --------------------------------------------------
// Command line arguments
// --------------------------------------------------

const articleFilePath = process.argv[2];
const locationFilePath = process.argv[3];
const placementFilePath = process.argv[4];

if (
  !articleFilePath ||
  !locationFilePath ||
  !placementFilePath
) {
  console.error(
    "Usage: node scripts/analyze-placements.js <articles.csv> <locations.csv> <placements.csv>",
  );

  process.exit(1);
}


// --------------------------------------------------
// Read CSV files
// --------------------------------------------------

const articleRows = await readCsvFile(
  articleFilePath,
);

const locationRows = await readCsvFile(
  locationFilePath,
);

const placementRows = await readCsvFile(
  placementFilePath,
  {
    fromLine: 2,
  },
);


// --------------------------------------------------
// Map master data
// --------------------------------------------------

const articles = articleRows.map(
  mapArticleCsvRow,
);

// --------------------------------------------------
// Validate location codes before mapping
// --------------------------------------------------

const validLocationRows = [];
const invalidLocationRows = [];

for (const row of locationRows) {
  const locationCode = String(
    row.Lokation ?? "",
  ).trim();

  if (/^\d{9}$/.test(locationCode)) {
    validLocationRows.push(row);
  } else {
    invalidLocationRows.push({
      locationCode,
      zone: row.Zone,
      area: row.Lager_Område,
      subArea: row.Lager_DelOmråde,
      type: row.LokationsType,
    });
  }
}

const locations = validLocationRows.map(
  mapLocationCsvRow,
);

const placementRecords = placementRows
  .map(mapPlacementCsvRow)
  .filter((record) => record !== null);


// --------------------------------------------------
// Location statistics
// --------------------------------------------------

const pickLocations = locations.filter(
  (location) =>
    location.purpose === LocationPurpose.PICK,
);

const bufferLocations = locations.filter(
  (location) =>
    location.purpose === LocationPurpose.BUFFER,
);

const otherLocations = locations.filter(
  (location) =>
    location.purpose === LocationPurpose.OTHER,
);

console.log("");
console.log("Location validation");
console.log("-------------------");

console.log(
  `Location CSV rows:     ${locationRows.length}`,
);

console.log(
  `Valid location rows:   ${validLocationRows.length}`,
);

console.log(
  `Invalid location rows: ${invalidLocationRows.length}`,
);

if (invalidLocationRows.length > 0) {
  console.log("");
  console.log("First invalid locations");
  console.log("-----------------------");

  for (const item of invalidLocationRows.slice(0, 20)) {
    console.log({
      locationCode: item.locationCode,
      zone: item.zone,
      area: item.area,
      subArea: item.subArea,
      type: item.type,
    });
  }
}
// --------------------------------------------------
// Build domain placements
// --------------------------------------------------

const result = buildPlacements(
  placementRecords,
  articles,
  locations,
);


// --------------------------------------------------
// Split placements by location purpose
// --------------------------------------------------

const pickPlacements = result.placements.filter(
  (placement) =>
    placement.location.purpose ===
    LocationPurpose.PICK,
);

const bufferPlacements = result.placements.filter(
  (placement) =>
    placement.location.purpose ===
    LocationPurpose.BUFFER,
);

const otherPlacements = result.placements.filter(
  (placement) =>
    placement.location.purpose ===
    LocationPurpose.OTHER,
);


// --------------------------------------------------
// Group pick placements by article
// --------------------------------------------------

const pickPlacementsByArticle = new Map();

for (const placement of pickPlacements) {
  const articleNumber =
    placement.article.articleNumber;

  if (!pickPlacementsByArticle.has(articleNumber)) {
    pickPlacementsByArticle.set(
      articleNumber,
      [],
    );
  }

  pickPlacementsByArticle
    .get(articleNumber)
    .push(placement);
}

const articlesWithMultiplePickLocations = [
  ...pickPlacementsByArticle.entries(),
].filter(
  ([, placements]) => placements.length > 1,
);


// --------------------------------------------------
// Output
// --------------------------------------------------

console.log("");
console.log(
  "TrendTornado Placement Analysis",
);

console.log(
  "===============================",
);


// --------------------------------------------------
// Import summary
// --------------------------------------------------

console.log("");
console.log("Import");
console.log("------");

console.log(
  `Article rows:          ${articleRows.length}`,
);

console.log(
  `Location rows:         ${locationRows.length}`,
);

console.log(
  `Placement CSV rows:    ${placementRows.length}`,
);

console.log(
  `Placement records:     ${placementRecords.length}`,
);


// --------------------------------------------------
// Warehouse structure
// --------------------------------------------------

console.log("");
console.log("Warehouse structure");
console.log("-------------------");

console.log(
  `Pick locations:        ${pickLocations.length}`,
);

console.log(
  `Buffer locations:      ${bufferLocations.length}`,
);

console.log(
  `Other locations:       ${otherLocations.length}`,
);


// --------------------------------------------------
// Placement validation
// --------------------------------------------------

console.log("");
console.log("Placement validation");
console.log("--------------------");

console.log(
  `Valid placements:      ${result.placements.length}`,
);

console.log(
  `Pick placements:       ${pickPlacements.length}`,
);

console.log(
  `Buffer placements:     ${bufferPlacements.length}`,
);

console.log(
  `Other placements:      ${otherPlacements.length}`,
);

console.log(
  `Missing articles:      ${result.missingArticles.length}`,
);

console.log(
  `Missing locations:     ${result.missingLocations.length}`,
);

console.log(
  `Rejected placements:   ${result.rejectedPlacements.length}`,
);


// --------------------------------------------------
// Missing articles
// --------------------------------------------------

if (result.missingArticles.length > 0) {
  console.log("");
  console.log("First missing articles");
  console.log("----------------------");

  for (
    const record
    of result.missingArticles.slice(0, 10)
  ) {
    console.log(
      `${record.articleNumber.padEnd(10)} ` +
      `${record.locationCode.padEnd(12)} ` +
      `${record.description}`,
    );
  }
}


// --------------------------------------------------
// Missing locations
// --------------------------------------------------

if (result.missingLocations.length > 0) {
  console.log("");
  console.log("First missing locations");
  console.log("-----------------------");

  for (
    const record
    of result.missingLocations.slice(0, 10)
  ) {
    console.log(
      `${record.locationCode.padEnd(12)} ` +
      `article ${record.articleNumber}`,
    );
  }
}


// --------------------------------------------------
// Rejected placements
// --------------------------------------------------

if (result.rejectedPlacements.length > 0) {
  console.log("");
  console.log("First rejected placements");
  console.log("-------------------------");

  for (
    const item
    of result.rejectedPlacements.slice(0, 10)
  ) {
    console.log(
      `${item.record.articleNumber.padEnd(10)} ` +
      `${item.record.locationCode.padEnd(12)} ` +
      `${item.reason}`,
    );
  }
}


// --------------------------------------------------
// Sample pick placements
// --------------------------------------------------

console.log("");
console.log("Sample pick placements");
console.log("----------------------");

for (
  const placement
  of pickPlacements.slice(0, 10)
) {
  console.log(
    `${placement.article.articleNumber.padEnd(8)} ` +
    `${placement.article.name
      .slice(0, 35)
      .padEnd(35)} ` +
    `→ ${placement.location.locationCode}`,
  );
}


// --------------------------------------------------
// Multiple PICK locations
// --------------------------------------------------

console.log("");
console.log("Multiple PICK placements");
console.log("------------------------");

console.log(
  `Articles on multiple PICK locations: ` +
  `${articlesWithMultiplePickLocations.length}`,
);

for (
  const [articleNumber, placements]
  of articlesWithMultiplePickLocations.slice(
    0,
    10,
  )
) {
  const article = placements[0].article;

  const locationCodes = placements.map(
    (placement) =>
      placement.location.locationCode,
  );

  console.log(
    `${articleNumber.padEnd(8)} ` +
    `${article.name.slice(0, 30).padEnd(30)} ` +
    `→ ${locationCodes.join(", ")}`,
  );
}

const rejectionBreakdown = new Map();

for (const item of result.rejectedPlacements) {
  const key =
    `${item.article.temperatureZone} -> ${item.location.temperatureZone}`;

  rejectionBreakdown.set(
    key,
    (rejectionBreakdown.get(key) ?? 0) + 1,
  );
}

console.log("");
console.log("Temperature mismatch breakdown");
console.log("------------------------------");

const sortedRejections = [
  ...rejectionBreakdown.entries(),
].sort(([, countA], [, countB]) => countB - countA);

for (const [type, count] of sortedRejections) {
  console.log(
    `${type.padEnd(20)} ${String(count).padStart(6)} placements`,
  );
}
const rejectedByPhysicalZone = new Map();

for (const item of result.rejectedPlacements) {
  const zone = item.location.zone;

  rejectedByPhysicalZone.set(
    zone,
    (rejectedByPhysicalZone.get(zone) ?? 0) + 1,
  );
}

console.log("");
console.log("Rejected placements by physical zone");
console.log("------------------------------------");

const sortedZones = [
  ...rejectedByPhysicalZone.entries(),
].sort(([, countA], [, countB]) => countB - countA);

for (const [zone, count] of sortedZones) {
  console.log(
    `Zone ${zone}: ${count} rejected placements`,
  );
}