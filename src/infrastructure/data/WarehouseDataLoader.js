import {
  readCsvFile,
} from "../csv/CsvReader.js";

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
    this.#assertPath(
      historyPath,
      "History",
    );

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

    const historyRows =
      await readCsvFile(
        historyPath,
      );

    const articleRows =
      await readCsvFile(
        articlePath,
      );

    const locationRows =
      await readCsvFile(
        locationPath,
      );

    const placementRows =
      await readCsvFile(
        placementPath,
        {
          fromLine: 2,
        },
      );


    // --------------------------------------------------
    // History
    // --------------------------------------------------

    const historyRecords =
      historyRows
        .map(
          mapPickHistoryCsvRow,
        )
        .filter(
          (record) =>
            record !== null,
        );


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
}