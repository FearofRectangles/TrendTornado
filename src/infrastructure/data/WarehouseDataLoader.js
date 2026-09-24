import {
  readCsvFile,
} from "../csv/CsvReader.js";
import { readPlacementCsvFile } from "../csv/PlacementCsvReader.js";

import {
  mapPickHistoryCsvRow,
} from "../importers/history/PickHistoryCsvMapper.js";

import {
  mapArticleCsvRow,
} from "../importers/article/ArticleCsvMapper.js";

import {
  mapLocationCsvRow,
} from "../importers/location/LocationCsvMapper.js";

import {
  mapPlacementCsvRow,
} from "../importers/placement/PlacementCsvMapper.js";


export class WarehouseDataLoader {
  static async load({
    historyPath,
    articlePath,
    locationPath,
    placementPath,
  }) {
    const historyPaths =
      this.#normalizeHistoryPaths(historyPath);

    this.#assertPath(
      articlePath,
      "Article",
    );

    this.#assertPath(
      locationPath,
      "Location",
    );

    this.#assertPath(
      placementPath,
      "Placement",
    );


    // --------------------------------------------------
    // Read CSV files
    // --------------------------------------------------

    const historySourceRows =
      await Promise.all(
        historyPaths.map(async (sourcePath) => ({
          path: sourcePath,
          rows: await readCsvFile(sourcePath),
        })),
      );

    const articleRows =
      await readCsvFile(
        articlePath,
      );

    const locationRows =
      await readCsvFile(
        locationPath,
      );

    const placementSource =
      await readPlacementCsvFile(
        placementPath,
      );

    const placementRows =
      placementSource.rows;


    // --------------------------------------------------
    // History
    // --------------------------------------------------

    const mappedHistorySources =
      historySourceRows.map((source) => ({
        ...source,
        records: source.rows
          .map(mapPickHistoryCsvRow)
          .filter((record) => record !== null),
      }));

    const historyMerge =
      mergeHistoryRecordSources(mappedHistorySources);

    const historyRecords =
      historyMerge.records;

    const historyRows =
      historySourceRows.flatMap((source) => source.rows);


    // --------------------------------------------------
    // Articles
    // --------------------------------------------------

    const articles =
      articleRows.map(
        mapArticleCsvRow,
      );


    // --------------------------------------------------
    // Locations
    // --------------------------------------------------

    const validLocationRows = [];
    const invalidLocationRows = [];

    for (
      const row
      of locationRows
    ) {
      const locationCode =
        String(
          row.Lokation ?? "",
        ).trim();

      if (
        /^\d{9}$/.test(
          locationCode,
        )
      ) {
        validLocationRows.push(
          row,
        );
      } else {
        invalidLocationRows.push(
          row,
        );
      }
    }

    const locations =
      validLocationRows.map(
        mapLocationCsvRow,
      );


    // --------------------------------------------------
    // Placements
    // --------------------------------------------------

    const placementRecords =
      placementRows
        .map(
          mapPlacementCsvRow,
        )
        .filter(
          (record) =>
            record !== null,
        );


    // --------------------------------------------------
    // Result
    // --------------------------------------------------

    return {
      historyRecords,
      articles,
      locations,
      placementRecords,

      importSummary: {
        historyRows:
          historyRows.length,

        validHistoryRecords:
          historyRecords.length,

        historyFiles:
          historyPaths.length,

        duplicateHistoryDocuments:
          historyMerge.duplicateDocuments,

        duplicateHistoryRecords:
          historyMerge.duplicateRecords,

        historySources:
          historyMerge.sources,

        articleRows:
          articleRows.length,

        locationRows:
          locationRows.length,

        validLocationRows:
          validLocationRows.length,

        invalidLocationRows:
          invalidLocationRows.length,

        placementRows:
          placementRows.length,

        validPlacementRecords:
          placementRecords.length,

        placementFormat:
          placementSource.diagnostics.format,

        ignoredPlacementRows:
          placementSource.diagnostics.ignoredRows,
      },

      invalidLocationRows,
    };
  }


  // --------------------------------------------------
  // Validation
  // --------------------------------------------------

  static #assertPath(
    path,
    label,
  ) {
    if (
      typeof path !== "string" ||
      path.trim() === ""
    ) {
      throw new TypeError(
        `${label} file path is required.`,
      );
    }
  }

  static #normalizeHistoryPaths(historyPath) {
    const paths = Array.isArray(historyPath)
      ? historyPath
      : [historyPath];

    if (paths.length === 0) {
      throw new TypeError("At least one history file path is required.");
    }

    for (const sourcePath of paths) {
      this.#assertPath(sourcePath, "History");
    }

    return paths;
  }
}

export function mergeHistoryRecordSources(sources) {
  if (!Array.isArray(sources)) {
    throw new TypeError("History sources must be an array.");
  }

  const seenDocuments = new Set();
  const records = [];
  const sourceSummaries = [];
  let duplicateDocuments = 0;
  let duplicateRecords = 0;

  for (const source of sources) {
    if (!Array.isArray(source.records)) {
      throw new TypeError("Every history source must contain records.");
    }

    const documents = new Set(
      source.records.map((record) => String(record.documentNumber)),
    );
    const overlappingDocuments = new Set(
      [...documents].filter((documentNumber) => seenDocuments.has(documentNumber)),
    );
    const acceptedRecords = source.records.filter((record) => (
      !overlappingDocuments.has(String(record.documentNumber))
    ));
    const excludedRecords = source.records.length - acceptedRecords.length;

    records.push(...acceptedRecords);
    documents.forEach((documentNumber) => seenDocuments.add(documentNumber));
    duplicateDocuments += overlappingDocuments.size;
    duplicateRecords += excludedRecords;
    sourceSummaries.push({
      path: source.path,
      rows: source.rows?.length ?? source.records.length,
      validRecords: source.records.length,
      includedRecords: acceptedRecords.length,
      duplicateDocuments: overlappingDocuments.size,
      duplicateRecords: excludedRecords,
    });
  }

  return {
    records,
    sources: sourceSummaries,
    duplicateDocuments,
    duplicateRecords,
  };
}
