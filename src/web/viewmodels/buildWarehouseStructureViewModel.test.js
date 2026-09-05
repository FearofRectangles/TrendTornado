import test from "node:test";
import assert from "node:assert/strict";
import { buildWarehouseStructureViewModel } from "./buildWarehouseStructureViewModel.js";

test("groups pick locations into pick zones, physical zones and bays", () => {
  const location = {
    locationCode: "200160401",
    pickZoneType: "GRÖNSAKER",
    zone: "20",
    bay: "016",
    shelf: "04",
    position: "01",
  };
  const article = { articleNumber: "42570", name: "Potatis", weightKg: 7 };
  const analysis = {
    evaluations: { all: [{ articleNumber: "42570", priorityScore: 0.91, placementGap: 0.75 }] },
    articles: { positioned: [{ articleNumber: "42570", pickFrequency: 187 }] },
    placements: { pickPlacements: [{ location, article }] },
    warehouse: { pickSequence: [{ location, pickSequence: 1 }] },
  };

  const result = buildWarehouseStructureViewModel(analysis);
  const bay = result.pickZones[0].zones[0].bays[0];
  assert.equal(result.summary.pickZones, 1);
  assert.equal(result.summary.bays, 1);
  assert.equal(bay.bay, "016");
  assert.equal(bay.articleCount, 1);
  assert.equal(bay.locations[0].articles[0].articleNumber, "42570");
  assert.equal(bay.metrics.priority, 0.91);
});
