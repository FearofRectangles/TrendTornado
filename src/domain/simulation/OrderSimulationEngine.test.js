import test from "node:test";
import assert from "node:assert/strict";

import {
  OrderSimulationEngine,
} from "./OrderSimulationEngine.js";


test("calculates pick span from first to last pick", () => {
  const result =
    OrderSimulationEngine.simulate({
      documentNumber:
        "UT100",

      picks: [
        {
          articleNumber: "A",
          pickedQuantity: 1,
          weightKg: 5,
          relativePosition: 0.20,
        },

        {
          articleNumber: "B",
          pickedQuantity: 1,
          weightKg: 2,
          relativePosition: 0.80,
        },

        {
          articleNumber: "C",
          pickedQuantity: 1,
          weightKg: 1,
          relativePosition: 0.50,
        },
      ],
    });

  assert.equal(
    result.firstPosition,
    0.20,
  );

  assert.equal(
    result.lastPosition,
    0.80,
  );

  assert.ok(
    Math.abs(
      result.pickSpan -
      0.60,
    ) <
      Number.EPSILON,
  );
});


test("calculates weight ordering across all comparable pairs", () => {
  const result =
    OrderSimulationEngine.simulate({
      documentNumber:
        "UT200",

      picks: [
        {
          articleNumber: "A",
          pickedQuantity: 1,
          weightKg: 10,
          relativePosition: 0.10,
        },

        {
          articleNumber: "B",
          pickedQuantity: 1,
          weightKg: 2,
          relativePosition: 0.20,
        },

        {
          articleNumber: "C",
          pickedQuantity: 1,
          weightKg: 8,
          relativePosition: 0.30,
        },

        {
          articleNumber: "D",
          pickedQuantity: 1,
          weightKg: 1,
          relativePosition: 0.40,
        },
      ],
    });

  assert.equal(
    result.correctlyOrderedPairs,
    5,
  );

  assert.equal(
    result.comparablePairs,
    6,
  );

  assert.equal(
    result.weightOrderScore,
    5 / 6,
  );
});


test("uses picked quantity when calculating handled weight", () => {
  const result =
    OrderSimulationEngine.simulate({
      documentNumber:
        "UT300",

      picks: [
        {
          articleNumber: "A",
          pickedQuantity: 6,
          weightKg: 2,
          relativePosition: 0.10,
        },

        {
          articleNumber: "B",
          pickedQuantity: 1,
          weightKg: 5,
          relativePosition: 0.20,
        },
      ],
    });

  // A = 12 kg handled
  // B = 5 kg handled
  //
  // Heavy load appears first.

  assert.equal(
    result.correctlyOrderedPairs,
    1,
  );

  assert.equal(
    result.comparablePairs,
    1,
  );

  assert.equal(
    result.weightOrderScore,
    1,
  );
});


test("detects reversed handled-weight order", () => {
  const result =
    OrderSimulationEngine.simulate({
      documentNumber:
        "UT400",

      picks: [
        {
          articleNumber: "A",
          pickedQuantity: 1,
          weightKg: 2,
          relativePosition: 0.10,
        },

        {
          articleNumber: "B",
          pickedQuantity: 1,
          weightKg: 10,
          relativePosition: 0.20,
        },
      ],
    });

  assert.equal(
    result.correctlyOrderedPairs,
    0,
  );

  assert.equal(
    result.comparablePairs,
    1,
  );

  assert.equal(
    result.weightOrderScore,
    0,
  );
});


test("ignores pairs with equal handled weight", () => {
  const result =
    OrderSimulationEngine.simulate({
      documentNumber:
        "UT500",

      picks: [
        {
          articleNumber: "A",
          pickedQuantity: 1,
          weightKg: 5,
          relativePosition: 0.10,
        },

        {
          articleNumber: "B",
          pickedQuantity: 5,
          weightKg: 1,
          relativePosition: 0.20,
        },
      ],
    });

  assert.equal(
    result.comparablePairs,
    0,
  );

  assert.equal(
    result.correctlyOrderedPairs,
    0,
  );

  assert.equal(
    result.weightOrderScore,
    1,
  );
});


test("sorts picks by relative position before evaluating", () => {
  const result =
    OrderSimulationEngine.simulate({
      documentNumber:
        "UT600",

      picks: [
        {
          articleNumber: "LIGHT",
          pickedQuantity: 1,
          weightKg: 1,
          relativePosition: 0.80,
        },

        {
          articleNumber: "HEAVY",
          pickedQuantity: 1,
          weightKg: 10,
          relativePosition: 0.20,
        },
      ],
    });

  assert.equal(
    result.weightOrderScore,
    1,
  );
});


test("rejects an empty pick list", () => {
  assert.throws(
    () =>
      OrderSimulationEngine.simulate({
        documentNumber:
          "UT700",

        picks: [],
      }),
    /at least one pick/i,
  );
});