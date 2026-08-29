import test from "node:test";
import assert from "node:assert/strict";

import {
  OrderSimulation,
} from "./OrderSimulation.js";


test("creates a valid order simulation", () => {
  const simulation =
    new OrderSimulation({
      documentNumber:
        "UT121519195",

      pickCount:
        4,

      firstPosition:
        0.10,

      lastPosition:
        0.80,

      pickSpan:
        0.70,

      weightOrderScore:
        5 / 6,

      correctlyOrderedPairs:
        5,

      comparablePairs:
        6,
    });


  assert.equal(
    simulation.documentNumber,
    "UT121519195",
  );

  assert.equal(
    simulation.pickCount,
    4,
  );

  assert.equal(
    simulation.pickSpan,
    0.70,
  );

  assert.equal(
    simulation.correctlyOrderedPairs,
    5,
  );

  assert.equal(
    simulation.comparablePairs,
    6,
  );
});


test("rejects invalid weight order score", () => {
  assert.throws(
    () => {
      new OrderSimulation({
        documentNumber:
          "UT1",

        pickCount:
          2,

        firstPosition:
          0.10,

        lastPosition:
          0.50,

        pickSpan:
          0.40,

        weightOrderScore:
          1.2,

        correctlyOrderedPairs:
          1,

        comparablePairs:
          1,
      });
    },
    /Weight order score/,
  );
});


test("rejects more correct pairs than comparable pairs", () => {
  assert.throws(
    () => {
      new OrderSimulation({
        documentNumber:
          "UT1",

        pickCount:
          3,

        firstPosition:
          0.10,

        lastPosition:
          0.60,

        pickSpan:
          0.50,

        weightOrderScore:
          1,

        correctlyOrderedPairs:
          4,

        comparablePairs:
          3,
      });
    },
    /cannot exceed/,
  );
});


test("rejects first position after last position", () => {
  assert.throws(
    () => {
      new OrderSimulation({
        documentNumber:
          "UT1",

        pickCount:
          2,

        firstPosition:
          0.80,

        lastPosition:
          0.20,

        pickSpan:
          0.60,

        weightOrderScore:
          1,

        correctlyOrderedPairs:
          1,

        comparablePairs:
          1,
      });
    },
    /First position/,
  );
});