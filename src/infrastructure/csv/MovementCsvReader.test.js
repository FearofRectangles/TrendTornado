import test from "node:test";
import assert from "node:assert/strict";
import { mapMovementRow } from "./MovementCsvReader.js";

test("maps a timed WMS goods movement with O order number", () => {
  const result = mapMovementRow({ ActivityId: "O121885345", WorkerName: "EPE", textbox23: "Normal order", ClientName: "Testkund", Textbox168: "42570", MaterialDescription: "Potatis", textbox28: "2,000", textbox26: "210010101", textbox27: "BOX10266851", c_WarehouseFrom: "01", c_WarehouseTo: "01", textbox29: "14-09-2026 08:02:00" });
  assert.equal(result.orderNumber, "O121885345");
  assert.equal(result.articleNumber, "42570");
  assert.equal(result.quantity, 2);
  assert.equal(result.sourceLocation, "210010101");
  assert.equal(result.occurredAt.getFullYear(), 2026);
});

test("ignores the report detail rows without worker and timestamp", () => {
  assert.equal(mapMovementRow({ ActivityId: "O121885345", WorkerName: "", Textbox168: "" }), null);
});

test("ignores zero-quantity movement rows", () => {
  assert.equal(mapMovementRow({ ActivityId: "O121885345", WorkerName: "EPE", Textbox168: "42570", textbox28: "0,000", textbox26: "210010101", textbox29: "14-09-2026 08:02:00" }), null);
});
