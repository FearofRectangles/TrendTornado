import {
  PickHistoryRecord,
} from "../analytics/history/PickHistoryRecord.js";


export class HistoricalOrderBuilder {

  static build({
    historyRecords,
    articles,
  }) {
    return this.buildWithDiagnostics({
      historyRecords,
      articles,
    }).orders;
  }


  static buildWithDiagnostics({
    historyRecords,
    articles,
  }) {
    if (!Array.isArray(historyRecords)) {
      throw new TypeError(
        "History records must be an array.",
      );
    }

    if (!Array.isArray(articles)) {
      throw new TypeError(
        "Articles must be an array.",
      );
    }


    // --------------------------------------------------
    // Article lookup
    // --------------------------------------------------

    const articlesByNumber =
      new Map(
        articles.map(
          (article) => [
            article.articleNumber,
            article,
          ],
        ),
      );


    // --------------------------------------------------
    // Diagnostics
    // --------------------------------------------------

    const diagnostics = {
      totalRecords:
        historyRecords.length,

      validRecords: 0,

      includedRecords: 0,

      excludedRecords: 0,

      missingArticle: 0,

      invalidWeight: 0,

      noPickLocation: 0,

      multiplePickLocations: 0,

      noSequencePosition: 0,

      missingPickZone: 0,

      totalDocuments: 0,

      fullyCoveredDocuments: 0,

      partiallyCoveredDocuments: 0,

      uncoveredDocuments: 0,

      recordsExcludedByDocumentFilter: 0,

      simulatedGroups: 0,
    };


    // --------------------------------------------------
    // Document analysis
    //
    // First we collect ALL historical records by UT.
    //
    // A document is only allowed into the official
    // simulation if every historical pick in that
    // document can be simulated.
    // --------------------------------------------------

    const documents =
      new Map();


    for (
      const record
      of historyRecords
    ) {
      if (
        !(
          record instanceof
          PickHistoryRecord
        )
      ) {
        throw new TypeError(
          "Every history record must be a PickHistoryRecord.",
        );
      }


      if (
        !documents.has(
          record.documentNumber,
        )
      ) {
        documents.set(
          record.documentNumber,
          {
            documentNumber:
              record.documentNumber,

            totalRecords: 0,

            validRecords: 0,

            validPicks: [],
          },
        );
      }


      const document =
        documents.get(
          record.documentNumber,
        );


      document.totalRecords++;


      // ------------------------------------------------
      // Known article
      // ------------------------------------------------

      const article =
        articlesByNumber.get(
          record.articleNumber,
        );


      if (!article) {
        diagnostics
          .missingArticle++;

        diagnostics
          .excludedRecords++;

        continue;
      }


      // ------------------------------------------------
      // Valid article weight
      // ------------------------------------------------

      if (
        !Number.isFinite(
          article.weightKg,
        ) ||
        article.weightKg < 0
      ) {
        diagnostics
          .invalidWeight++;

        diagnostics
          .excludedRecords++;

        continue;
      }


      // ------------------------------------------------
      // PICK location
      // ------------------------------------------------

      const positionedPickLocations =
        article
          .positionedPickLocations;


      if (
        !Array.isArray(
          positionedPickLocations,
        ) ||
        positionedPickLocations
          .length === 0
      ) {
        diagnostics
          .noPickLocation++;

        diagnostics
          .excludedRecords++;

        continue;
      }


      if (
        positionedPickLocations
          .length > 1
      ) {
        diagnostics
          .multiplePickLocations++;

        diagnostics
          .excludedRecords++;

        continue;
      }


      const positioned =
        positionedPickLocations[0];


      // ------------------------------------------------
      // Relative PICK position
      // ------------------------------------------------

      if (
        !Number.isFinite(
          positioned
            .relativePickPosition,
        )
      ) {
        diagnostics
          .noSequencePosition++;

        diagnostics
          .excludedRecords++;

        continue;
      }


      // ------------------------------------------------
      // Pick zone
      // ------------------------------------------------

      const pickZoneType =
        positioned
          .location
          ?.pickZoneType;


      if (
        typeof pickZoneType !==
          "string" ||
        pickZoneType.trim() === ""
      ) {
        diagnostics
          .missingPickZone++;

        diagnostics
          .excludedRecords++;

        continue;
      }


      // ------------------------------------------------
      // Valid historical pick
      // ------------------------------------------------

      const pick = {
        articleNumber:
          record.articleNumber,

        pickedQuantity:
          record.pickedQuantity,

        weightKg:
          article.weightKg,

        relativePosition:
          positioned
            .relativePickPosition,

        pickZoneType,
      };


      document.validRecords++;

      document.validPicks.push(
        pick,
      );


      diagnostics.validRecords++;
    }


    // --------------------------------------------------
    // Document coverage
    // --------------------------------------------------

    diagnostics.totalDocuments =
      documents.size;


    const orderGroups =
      new Map();


    for (
      const document
      of documents.values()
    ) {
      const {
        documentNumber,
        totalRecords,
        validRecords,
        validPicks,
      } = document;


      // ------------------------------------------------
      // No usable picks
      // ------------------------------------------------

      if (
        validRecords === 0
      ) {
        diagnostics
          .uncoveredDocuments++;

        continue;
      }


      // ------------------------------------------------
      // Partial document
      //
      // Some picks could be simulated, but not all.
      // None of them are allowed into the official
      // baseline.
      // ------------------------------------------------

      if (
        validRecords <
        totalRecords
      ) {
        diagnostics
          .partiallyCoveredDocuments++;

        diagnostics
          .recordsExcludedByDocumentFilter +=
            validRecords;

        continue;
      }


      // ------------------------------------------------
      // Fully covered document
      // ------------------------------------------------

      diagnostics
        .fullyCoveredDocuments++;


      diagnostics
        .includedRecords +=
          validRecords;


      // ------------------------------------------------
      // Split the complete UT into independent
      // pick-zone flows.
      // ------------------------------------------------

      for (
        const pick
        of validPicks
      ) {
        const groupKey =
          `${documentNumber}` +
          `::${pick.pickZoneType}`;


        if (
          !orderGroups.has(
            groupKey,
          )
        ) {
          orderGroups.set(
            groupKey,
            {
              documentNumber,

              pickZoneType:
                pick.pickZoneType,

              picks: [],
            },
          );
        }


        orderGroups
          .get(groupKey)
          .picks
          .push({
            articleNumber:
              pick.articleNumber,

            pickedQuantity:
              pick.pickedQuantity,

            weightKg:
              pick.weightKg,

            relativePosition:
              pick.relativePosition,
          });
      }
    }


    // --------------------------------------------------
    // Result
    // --------------------------------------------------

    const orders = [
      ...orderGroups.values(),
    ];


    diagnostics.simulatedGroups =
      orders.length;


    return {
      orders,
      diagnostics,
    };
  }
}