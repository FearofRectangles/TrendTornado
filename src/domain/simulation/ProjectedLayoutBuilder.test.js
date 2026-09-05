import test from "node:test";
import assert from "node:assert/strict";

import {
  ProjectedLayoutBuilder,
} from "./ProjectedLayoutBuilder.js";


function createHistoricalOrder() {
  return {
    documentNumber:
      "UT100",

    picks: [
      {
        articleNumber:
          "A",

        pickedQuantity:
          1,

        weightKg:
          10,

        relativePosition:
          0.80,
      },

      {
        articleNumber:
          "B",

        pickedQuantity:
          2,

        weightKg:
          2,

        relativePosition:
          0.40,
      },
    ],
  };
}


function createEvaluation({
  articleNumber,
  placementGap,
  desiredPosition,
}) {
  return {
    articleNumber,
    placementGap,
    desiredPosition,
  };
}


test(
  "moves article to desired position when gap reaches threshold",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    const evaluations = [
      createEvaluation({
        articleNumber:
          "A",

        placementGap:
          0.50,

        desiredPosition:
          0.20,
      }),
    ];

    const projected =
      ProjectedLayoutBuilder.build({
        historicalOrders,
        evaluations,
        movementThreshold:
          0.20,
      });

    assert.equal(
      projected[0]
        .picks[0]
        .relativePosition,
      0.20,
    );
  },
);


test(
  "keeps current position when gap is below threshold",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    const evaluations = [
      createEvaluation({
        articleNumber:
          "A",

        placementGap:
          0.19,

        desiredPosition:
          0.20,
      }),
    ];

    const projected =
      ProjectedLayoutBuilder.build({
        historicalOrders,
        evaluations,
        movementThreshold:
          0.20,
      });

    assert.equal(
      projected[0]
        .picks[0]
        .relativePosition,
      0.80,
    );
  },
);


test(
  "uses absolute gap for movements later in the pick flow",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    const evaluations = [
      createEvaluation({
        articleNumber:
          "B",

        placementGap:
          -0.30,

        desiredPosition:
          0.75,
      }),
    ];

    const projected =
      ProjectedLayoutBuilder.build({
        historicalOrders,
        evaluations,
        movementThreshold:
          0.20,
      });

    assert.equal(
      projected[0]
        .picks[1]
        .relativePosition,
      0.75,
    );
  },
);


test(
  "keeps current position when article has no evaluation",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    const projected =
      ProjectedLayoutBuilder.build({
        historicalOrders,
        evaluations: [],
        movementThreshold:
          0.20,
      });

    assert.equal(
      projected[0]
        .picks[0]
        .relativePosition,
      0.80,
    );

    assert.equal(
      projected[0]
        .picks[1]
        .relativePosition,
      0.40,
    );
  },
);


test(
  "does not mutate historical baseline orders",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    const evaluations = [
      createEvaluation({
        articleNumber:
          "A",

        placementGap:
          0.60,

        desiredPosition:
          0.10,
      }),
    ];

    const projected =
      ProjectedLayoutBuilder.build({
        historicalOrders,
        evaluations,
        movementThreshold:
          0.20,
      });

    assert.equal(
      historicalOrders[0]
        .picks[0]
        .relativePosition,
      0.80,
    );

    assert.equal(
      projected[0]
        .picks[0]
        .relativePosition,
      0.10,
    );

    assert.notEqual(
      projected[0],
      historicalOrders[0],
    );

    assert.notEqual(
      projected[0]
        .picks[0],
      historicalOrders[0]
        .picks[0],
    );
  },
);


test(
  "keeps exactly the same historical orders and picks",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),

      {
        documentNumber:
          "UT200",

        picks: [
          {
            articleNumber:
              "C",

            pickedQuantity:
              3,

            weightKg:
              4,

            relativePosition:
              0.25,
          },
        ],
      },
    ];

    const projected =
      ProjectedLayoutBuilder.build({
        historicalOrders,
        evaluations: [],
      });

    assert.equal(
      projected.length,
      2,
    );

    assert.equal(
      projected[0]
        .picks.length,
      2,
    );

    assert.equal(
      projected[1]
        .picks.length,
      1,
    );

    assert.equal(
      projected[0]
        .documentNumber,
      "UT100",
    );

    assert.equal(
      projected[1]
        .documentNumber,
      "UT200",
    );
  },
);


test(
  "rejects invalid desired position for article that should move",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    const evaluations = [
      createEvaluation({
        articleNumber:
          "A",

        placementGap:
          0.40,

        desiredPosition:
          1.20,
      }),
    ];

    assert.throws(
      () =>
        ProjectedLayoutBuilder.build({
          historicalOrders,
          evaluations,
        }),
      /Invalid desired position/,
    );
  },
);


test(
  "moves article when negative gap reaches threshold exactly",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    const evaluations = [
      createEvaluation({
        articleNumber:
          "B",

        placementGap:
          -0.20,

        desiredPosition:
          0.65,
      }),
    ];

    const projected =
      ProjectedLayoutBuilder.build({
        historicalOrders,
        evaluations,
        movementThreshold:
          0.20,
      });

    assert.equal(
      projected[0]
        .picks[1]
        .relativePosition,
      0.65,
    );
  },
);


test(
  "rejects invalid movement threshold",
  () => {
    const historicalOrders = [
      createHistoricalOrder(),
    ];

    assert.throws(
      () =>
        ProjectedLayoutBuilder.build({
          historicalOrders,
          evaluations: [],
          movementThreshold:
            1.50,
        }),
      /Movement threshold must be between 0 and 1/,
    );
  },
);