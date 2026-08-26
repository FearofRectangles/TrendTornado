import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveIdealPlacementArea,
} from "./ResolveIdealPlacementArea.js";

import {
  ZoneSection,
} from "../../domain/warehouse/zone/ZoneSection.js";

function createBay({
  pickZoneType = "KOLONIAL",
  zone,
  bay,
  sequence,
  totalBays,
}) {
  return {
    pickZoneType,
    zone,
    bay,
    sequence,
    totalBays,
  };
}

test("resolves desired position to physical zone and section", () => {
  const bayFlow = [
    createBay({
      zone: "01",
      bay: "001",
      sequence: 1,
      totalBays: 6,
    }),

    createBay({
      zone: "01",
      bay: "002",
      sequence: 2,
      totalBays: 6,
    }),

    createBay({
      zone: "01",
      bay: "003",
      sequence: 3,
      totalBays: 6,
    }),

    createBay({
      zone: "02",
      bay: "001",
      sequence: 4,
      totalBays: 6,
    }),

    createBay({
      zone: "02",
      bay: "002",
      sequence: 5,
      totalBays: 6,
    }),

    createBay({
      zone: "02",
      bay: "003",
      sequence: 6,
      totalBays: 6,
    }),
  ];

  const result =
    resolveIdealPlacementArea({
      desiredPosition: 0,
      pickZoneType:
        "KOLONIAL",
      bayFlow,
    });

  assert.equal(
    result.zone,
    "01",
  );

  assert.equal(
    result.targetBay,
    "001",
  );

  assert.equal(
    result.section,
    ZoneSection.BEGINNING,
  );
});

test("maps a position into the correct zone section", () => {
  const bayFlow = [
    createBay({
      zone: "01",
      bay: "001",
      sequence: 1,
      totalBays: 6,
    }),

    createBay({
      zone: "01",
      bay: "002",
      sequence: 2,
      totalBays: 6,
    }),

    createBay({
      zone: "01",
      bay: "003",
      sequence: 3,
      totalBays: 6,
    }),

    createBay({
      zone: "02",
      bay: "001",
      sequence: 4,
      totalBays: 6,
    }),

    createBay({
      zone: "02",
      bay: "002",
      sequence: 5,
      totalBays: 6,
    }),

    createBay({
      zone: "02",
      bay: "003",
      sequence: 6,
      totalBays: 6,
    }),
  ];

  const result =
    resolveIdealPlacementArea({
      desiredPosition: 0.8,
      pickZoneType:
        "KOLONIAL",
      bayFlow,
    });

  assert.equal(
    result.zone,
    "02",
  );

  assert.equal(
    result.targetBay,
    "002",
  );

  assert.equal(
    result.section,
    ZoneSection.MIDDLE,
  );
});

test("resolves end of flow to end of final zone", () => {
  const bayFlow = [
    createBay({
      zone: "01",
      bay: "001",
      sequence: 1,
      totalBays: 4,
    }),

    createBay({
      zone: "01",
      bay: "002",
      sequence: 2,
      totalBays: 4,
    }),

    createBay({
      zone: "02",
      bay: "001",
      sequence: 3,
      totalBays: 4,
    }),

    createBay({
      zone: "02",
      bay: "002",
      sequence: 4,
      totalBays: 4,
    }),
  ];

  const result =
    resolveIdealPlacementArea({
      desiredPosition: 1,
      pickZoneType:
        "KOLONIAL",
      bayFlow,
    });

  assert.equal(
    result.zone,
    "02",
  );

  assert.equal(
    result.targetBay,
    "002",
  );

  assert.equal(
    result.section,
    ZoneSection.END,
  );
});

test("returns null when pick zone has no bays", () => {
  const result =
    resolveIdealPlacementArea({
      desiredPosition: 0.5,
      pickZoneType:
        "FRYS",
      bayFlow: [],
    });

  assert.equal(
    result,
    null,
  );
});

test("rejects invalid desired position", () => {
  assert.throws(
    () =>
      resolveIdealPlacementArea({
        desiredPosition: 1.1,
        pickZoneType:
          "KOLONIAL",
        bayFlow: [],
      }),
    /between 0 and 1/i,
  );
});