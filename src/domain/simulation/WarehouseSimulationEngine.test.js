import test from "node:test";
import assert from "node:assert/strict";

import {
  WarehouseSimulationEngine,
} from "./WarehouseSimulationEngine.js";


function createPick({
  articleNumber,
  weightKg,
  position,
  quantity = 1,
}) {
  return {
    articleNumber,

    pickedQuantity:
      quantity,

    weightKg,

    relativePosition:
      position,
  };
}


test(
  "simulates multiple historical orders",
  () => {
    const orders = [
      {
        documentNumber:
          "UT100",

        picks: [
          createPick({
            articleNumber:
              "A",

            weightKg:
              10,

            position:
              0.10,
          }),

          createPick({
            articleNumber:
              "B",

            weightKg:
              2,

            position:
              0.50,
          }),
        ],
      },

      {
        documentNumber:
          "UT200",

        picks: [
          createPick({
            articleNumber:
              "C",

            weightKg:
              1,

            position:
              0.20,
          }),

          createPick({
            articleNumber:
              "D",

            weightKg:
              8,

            position:
              0.80,
          }),
        ],
      },
    ];


    const result =
      WarehouseSimulationEngine.simulate({
        orders,
      });


    assert.equal(
      result.simulatedOrders,
      2,
    );

    assert.equal(
      result.totalPicks,
      4,
    );

    assert.equal(
      result.orderSimulations.length,
      2,
    );
  },
);


test(
  "calculates average pick span across all groups",
  () => {
    const orders = [
      {
        documentNumber:
          "UT100",

        picks: [
          createPick({
            articleNumber:
              "A",

            weightKg:
              5,

            position:
              0.10,
          }),

          createPick({
            articleNumber:
              "B",

            weightKg:
              1,

            position:
              0.50,
          }),
        ],
      },

      {
        documentNumber:
          "UT200",

        picks: [
          createPick({
            articleNumber:
              "C",

            weightKg:
              5,

            position:
              0.20,
          }),

          createPick({
            articleNumber:
              "D",

            weightKg:
              1,

            position:
              0.80,
          }),
        ],
      },
    ];


    const result =
      WarehouseSimulationEngine.simulate({
        orders,
      });


    // UT100:
    // 0.50 - 0.10 = 0.40
    //
    // UT200:
    // 0.80 - 0.20 = 0.60
    //
    // Average:
    // (0.40 + 0.60) / 2
    // = 0.50

    assert.ok(
      Math.abs(
        result.averagePickSpan -
          0.50,
      ) <
        Number.EPSILON,
    );
  },
);


test(
  "counts single-pick and multi-pick groups",
  () => {
    const orders = [
      {
        documentNumber:
          "UT100",

        picks: [
          createPick({
            articleNumber:
              "A",

            weightKg:
              5,

            position:
              0.10,
          }),
        ],
      },

      {
        documentNumber:
          "UT200",

        picks: [
          createPick({
            articleNumber:
              "B",

            weightKg:
              8,

            position:
              0.20,
          }),

          createPick({
            articleNumber:
              "C",

            weightKg:
              2,

            position:
              0.70,
          }),
        ],
      },

      {
        documentNumber:
          "UT300",

        picks: [
          createPick({
            articleNumber:
              "D",

            weightKg:
              6,

            position:
              0.10,
          }),

          createPick({
            articleNumber:
              "E",

            weightKg:
              1,

            position:
              0.90,
          }),
        ],
      },
    ];


    const result =
      WarehouseSimulationEngine.simulate({
        orders,
      });


    assert.equal(
      result.simulatedOrders,
      3,
    );

    assert.equal(
      result.singlePickGroups,
      1,
    );

    assert.equal(
      result.multiPickGroups,
      2,
    );
  },
);


test(
  "calculates average pick span for multi-pick groups only",
  () => {
    const orders = [
      {
        documentNumber:
          "UT100",

        picks: [
          createPick({
            articleNumber:
              "A",

            weightKg:
              5,

            position:
              0.40,
          }),
        ],
      },

      {
        documentNumber:
          "UT200",

        picks: [
          createPick({
            articleNumber:
              "B",

            weightKg:
              8,

            position:
              0.10,
          }),

          createPick({
            articleNumber:
              "C",

            weightKg:
              2,

            position:
              0.50,
          }),
        ],
      },

      {
        documentNumber:
          "UT300",

        picks: [
          createPick({
            articleNumber:
              "D",

            weightKg:
              6,

            position:
              0.20,
          }),

          createPick({
            articleNumber:
              "E",

            weightKg:
              1,

            position:
              0.80,
          }),
        ],
      },
    ];


    const result =
      WarehouseSimulationEngine.simulate({
        orders,
      });


    // UT100:
    // single pick -> span 0.00
    //
    // UT200:
    // 0.50 - 0.10 = 0.40
    //
    // UT300:
    // 0.80 - 0.20 = 0.60
    //
    // Average all groups:
    // (0 + 0.40 + 0.60) / 3
    // = 0.3333...
    //
    // Average multi-pick only:
    // (0.40 + 0.60) / 2
    // = 0.50

    assert.ok(
      Math.abs(
        result.averagePickSpan -
          (1 / 3),
      ) <
        Number.EPSILON,
    );


    assert.ok(
      Math.abs(
        result.averageMultiPickSpan -
          0.50,
      ) <
        Number.EPSILON,
    );


    assert.equal(
      result.singlePickGroups,
      1,
    );

    assert.equal(
      result.multiPickGroups,
      2,
    );
  },
);


test(
  "aggregates weight ordering using all comparable pairs",
  () => {
    const orders = [
      {
        documentNumber:
          "UT100",

        picks: [
          createPick({
            articleNumber:
              "A",

            weightKg:
              10,

            position:
              0.10,
          }),

          createPick({
            articleNumber:
              "B",

            weightKg:
              5,

            position:
              0.20,
          }),

          createPick({
            articleNumber:
              "C",

            weightKg:
              1,

            position:
              0.30,
          }),
        ],
      },

      {
        documentNumber:
          "UT200",

        picks: [
          createPick({
            articleNumber:
              "D",

            weightKg:
              1,

            position:
              0.10,
          }),

          createPick({
            articleNumber:
              "E",

            weightKg:
              10,

            position:
              0.20,
          }),
        ],
      },
    ];


    const result =
      WarehouseSimulationEngine.simulate({
        orders,
      });


    // UT100:
    //
    // 10 > 5 ✓
    // 10 > 1 ✓
    //  5 > 1 ✓
    //
    // 3 / 3
    //
    // UT200:
    //
    // 1 before 10 ✗
    //
    // 0 / 1
    //
    // Warehouse:
    //
    // 3 / 4 = 75 %

    assert.equal(
      result.correctlyOrderedPairs,
      3,
    );

    assert.equal(
      result.comparablePairs,
      4,
    );

    assert.equal(
      result.weightOrderScore,
      0.75,
    );
  },
);


test(
  "uses handled quantity in warehouse simulation",
  () => {
    const orders = [
      {
        documentNumber:
          "UT100",

        picks: [
          createPick({
            articleNumber:
              "A",

            weightKg:
              2,

            quantity:
              6,

            position:
              0.10,
          }),

          createPick({
            articleNumber:
              "B",

            weightKg:
              5,

            quantity:
              1,

            position:
              0.20,
          }),
        ],
      },
    ];


    const result =
      WarehouseSimulationEngine.simulate({
        orders,
      });


    // A:
    // 2 kg * 6 = 12 kg
    //
    // B:
    // 5 kg * 1 = 5 kg
    //
    // The heavier handled load
    // appears first.

    assert.equal(
      result.weightOrderScore,
      1,
    );
  },
);


test(
  "returns zero multi-pick span when all groups contain one pick",
  () => {
    const orders = [
      {
        documentNumber:
          "UT100",

        picks: [
          createPick({
            articleNumber:
              "A",

            weightKg:
              5,

            position:
              0.20,
          }),
        ],
      },

      {
        documentNumber:
          "UT200",

        picks: [
          createPick({
            articleNumber:
              "B",

            weightKg:
              2,

            position:
              0.70,
          }),
        ],
      },
    ];


    const result =
      WarehouseSimulationEngine.simulate({
        orders,
      });


    assert.equal(
      result.singlePickGroups,
      2,
    );

    assert.equal(
      result.multiPickGroups,
      0,
    );

    assert.equal(
      result.averagePickSpan,
      0,
    );

    assert.equal(
      result.averageMultiPickSpan,
      0,
    );
  },
);


test(
  "returns an empty baseline for no orders",
  () => {
    const result =
      WarehouseSimulationEngine.simulate({
        orders: [],
      });


    assert.equal(
      result.simulatedOrders,
      0,
    );

    assert.equal(
      result.totalPicks,
      0,
    );

    assert.equal(
      result.singlePickGroups,
      0,
    );

    assert.equal(
      result.multiPickGroups,
      0,
    );

    assert.equal(
      result.averagePickSpan,
      0,
    );

    assert.equal(
      result.averageMultiPickSpan,
      0,
    );

    assert.equal(
      result.correctlyOrderedPairs,
      0,
    );

    assert.equal(
      result.comparablePairs,
      0,
    );

    assert.equal(
      result.weightOrderScore,
      1,
    );

    assert.deepEqual(
      result.orderSimulations,
      [],
    );
  },
);