import test from "node:test";
import assert from "node:assert/strict";

import {
  PickHistoryRecord,
} from "../analytics/history/PickHistoryRecord.js";

import {
  HistoricalOrderBuilder,
} from "./HistoricalOrderBuilder.js";


function createHistoryRecord({
  documentNumber,
  articleNumber,
  pickedQuantity,
}) {
  return new PickHistoryRecord({
    postingDate:
      new Date(
        "2026-08-30",
      ),

    documentNumber,

    articleNumber,

    pickedQuantity,
  });
}


function createArticle({
  articleNumber,
  weightKg,
  position,
  pickZoneType = "KOLONIAL",
}) {
  return {
    articleNumber,

    weightKg,

    positionedPickLocations: [
      {
        relativePickPosition:
          position,

        location: {
          locationCode:
            "010010101",

          pickZoneType,
        },
      },
    ],
  };
}


test(
  "groups historical picks by document number and pick zone",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          2,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "B",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT200",

        articleNumber:
          "C",

        pickedQuantity:
          4,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          2,

        position:
          0.10,
      }),

      createArticle({
        articleNumber:
          "B",

        weightKg:
          8,

        position:
          0.50,
      }),

      createArticle({
        articleNumber:
          "C",

        weightKg:
          1,

        position:
          0.80,
      }),
    ];


    const orders =
      HistoricalOrderBuilder.build({
        historyRecords,
        articles,
      });


    assert.equal(
      orders.length,
      2,
    );


    const ut100 =
      orders.find(
        (order) =>
          order.documentNumber ===
            "UT100" &&
          order.pickZoneType ===
            "KOLONIAL",
      );


    assert.ok(
      ut100,
    );


    assert.equal(
      ut100.picks.length,
      2,
    );


    assert.deepEqual(
      ut100.picks[0],
      {
        articleNumber:
          "A",

        pickedQuantity:
          2,

        weightKg:
          2,

        relativePosition:
          0.10,
      },
    );
  },
);


test(
  "creates separate simulation groups for different pick zones in the same document",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "B",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "C",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          5,

        position:
          0.10,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "B",

        weightKg:
          2,

        position:
          0.60,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "C",

        weightKg:
          8,

        position:
          0.20,

        pickZoneType:
          "KYLT",
      }),
    ];


    const orders =
      HistoricalOrderBuilder.build({
        historyRecords,
        articles,
      });


    assert.equal(
      orders.length,
      2,
    );


    const kolonial =
      orders.find(
        (order) =>
          order.pickZoneType ===
          "KOLONIAL",
      );


    const kylt =
      orders.find(
        (order) =>
          order.pickZoneType ===
          "KYLT",
      );


    assert.ok(
      kolonial,
    );

    assert.ok(
      kylt,
    );


    assert.equal(
      kolonial.documentNumber,
      "UT100",
    );

    assert.equal(
      kolonial.picks.length,
      2,
    );


    assert.equal(
      kylt.documentNumber,
      "UT100",
    );

    assert.equal(
      kylt.picks.length,
      1,
    );
  },
);


test(
  "preserves actual picked quantity from history",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          6,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          2,

        position:
          0.20,
      }),
    ];


    const orders =
      HistoricalOrderBuilder.build({
        historyRecords,
        articles,
      });


    assert.equal(
      orders[0]
        .picks[0]
        .pickedQuantity,
      6,
    );
  },
);


test(
  "reports unknown articles in diagnostics",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "UNKNOWN",

        pickedQuantity:
          1,
      }),
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,

          articles: [],
        });


    assert.deepEqual(
      result.orders,
      [],
    );


    assert.equal(
      result.diagnostics
        .totalRecords,
      1,
    );

    assert.equal(
      result.diagnostics
        .includedRecords,
      0,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );

    assert.equal(
      result.diagnostics
        .missingArticle,
      1,
    );
  },
);


test(
  "reports invalid article weight in diagnostics",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          Number.NaN,

        position:
          0.20,
      }),
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.orders.length,
      0,
    );

    assert.equal(
      result.diagnostics
        .invalidWeight,
      1,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );
  },
);


test(
  "reports articles without a PICK location in diagnostics",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      {
        articleNumber:
          "A",

        weightKg:
          5,

        positionedPickLocations:
          [],
      },
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.orders.length,
      0,
    );

    assert.equal(
      result.diagnostics
        .noPickLocation,
      1,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );
  },
);


test(
  "reports articles with multiple PICK locations in diagnostics",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      {
        articleNumber:
          "A",

        weightKg:
          5,

        positionedPickLocations: [
          {
            relativePickPosition:
              0.10,

            location: {
              locationCode:
                "010010101",

              pickZoneType:
                "KOLONIAL",
            },
          },

          {
            relativePickPosition:
              0.20,

            location: {
              locationCode:
                "010020101",

              pickZoneType:
                "KOLONIAL",
            },
          },
        ],
      },
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.orders.length,
      0,
    );

    assert.equal(
      result.diagnostics
        .multiplePickLocations,
      1,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );
  },
);


test(
  "reports missing sequence position in diagnostics",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      {
        articleNumber:
          "A",

        weightKg:
          5,

        positionedPickLocations: [
          {
            relativePickPosition:
              null,

            location: {
              locationCode:
                "010010101",

              pickZoneType:
                "KOLONIAL",
            },
          },
        ],
      },
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.orders.length,
      0,
    );

    assert.equal(
      result.diagnostics
        .noSequencePosition,
      1,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );
  },
);


test(
  "reports missing pick zone in diagnostics",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      {
        articleNumber:
          "A",

        weightKg:
          5,

        positionedPickLocations: [
          {
            relativePickPosition:
              0.30,

            location: {
              locationCode:
                "010010101",
            },
          },
        ],
      },
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.orders.length,
      0,
    );

    assert.equal(
      result.diagnostics
        .missingPickZone,
      1,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );
  },
);


test(
  "diagnostics count included and excluded records",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "B",

        pickedQuantity:
          2,
      }),

      createHistoryRecord({
        documentNumber:
          "UT200",

        articleNumber:
          "UNKNOWN",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          5,

        position:
          0.10,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "B",

        weightKg:
          2,

        position:
          0.60,

        pickZoneType:
          "KOLONIAL",
      }),
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.diagnostics
        .totalRecords,
      3,
    );

    assert.equal(
      result.diagnostics
        .includedRecords,
      2,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );

    assert.equal(
      result.diagnostics
        .missingArticle,
      1,
    );

    assert.equal(
      result.diagnostics
        .simulatedGroups,
      1,
    );
  },
);

test(
  "includes a document when every historical pick is simulatable",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "B",

        pickedQuantity:
          2,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          5,

        position:
          0.10,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "B",

        weightKg:
          2,

        position:
          0.60,

        pickZoneType:
          "KOLONIAL",
      }),
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.diagnostics
        .totalDocuments,
      1,
    );

    assert.equal(
      result.diagnostics
        .fullyCoveredDocuments,
      1,
    );

    assert.equal(
      result.diagnostics
        .partiallyCoveredDocuments,
      0,
    );

    assert.equal(
      result.diagnostics
        .uncoveredDocuments,
      0,
    );

    assert.equal(
      result.diagnostics
        .includedRecords,
      2,
    );

    assert.equal(
      result.orders.length,
      1,
    );
  },
);

test(
  "excludes the entire document when one historical pick cannot be simulated",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "B",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "C",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          10,

        position:
          0.10,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "B",

        weightKg:
          2,

        position:
          0.60,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "C",

        weightKg:
          Number.NaN,

        position:
          0.80,

        pickZoneType:
          "KOLONIAL",
      }),
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.diagnostics
        .validRecords,
      2,
    );

    assert.equal(
      result.diagnostics
        .includedRecords,
      0,
    );

    assert.equal(
      result.diagnostics
        .excludedRecords,
      1,
    );

    assert.equal(
      result.diagnostics
        .recordsExcludedByDocumentFilter,
      2,
    );

    assert.equal(
      result.diagnostics
        .partiallyCoveredDocuments,
      1,
    );

    assert.deepEqual(
      result.orders,
      [],
    );
  },
);

test(
  "splits a fully covered document into separate pick-zone groups",
  () => {
    const historyRecords = [
      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "A",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "B",

        pickedQuantity:
          1,
      }),

      createHistoryRecord({
        documentNumber:
          "UT100",

        articleNumber:
          "C",

        pickedQuantity:
          1,
      }),
    ];


    const articles = [
      createArticle({
        articleNumber:
          "A",

        weightKg:
          8,

        position:
          0.10,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "B",

        weightKg:
          2,

        position:
          0.70,

        pickZoneType:
          "KOLONIAL",
      }),

      createArticle({
        articleNumber:
          "C",

        weightKg:
          5,

        position:
          0.30,

        pickZoneType:
          "KYLT",
      }),
    ];


    const result =
      HistoricalOrderBuilder
        .buildWithDiagnostics({
          historyRecords,
          articles,
        });


    assert.equal(
      result.diagnostics
        .fullyCoveredDocuments,
      1,
    );

    assert.equal(
      result.diagnostics
        .includedRecords,
      3,
    );

    assert.equal(
      result.orders.length,
      2,
    );


    const kolonial =
      result.orders.find(
        (order) =>
          order.pickZoneType ===
          "KOLONIAL",
      );


    const kylt =
      result.orders.find(
        (order) =>
          order.pickZoneType ===
          "KYLT",
      );


    assert.equal(
      kolonial.picks.length,
      2,
    );

    assert.equal(
      kylt.picks.length,
      1,
    );
  },
);