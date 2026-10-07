import test from "node:test";
import assert from "node:assert/strict";
import { PickHistoryRecord } from "../../../domain/analytics/history/PickHistoryRecord.js";
import { configureExcludedArticles } from "../../../domain/analytics/history/PickHistoryRules.js";
import { mapMovementToPickHistoryRecord } from "./MovementHistoryMapper.js";

test("maps a WMS movement into the shared history model", () => {
  configureExcludedArticles([]);
  const record = mapMovementToPickHistoryRecord({
    occurredAt: new Date(2026, 8, 14, 8, 2, 0),
    orderNumber: "O121885345",
    articleNumber: "42570",
    quantity: 2,
  });

  assert.ok(record instanceof PickHistoryRecord);
  assert.equal(record.documentNumber, "O121885345");
  assert.equal(record.articleNumber, "42570");
  assert.equal(record.pickedQuantity, 2);
  assert.equal(record.postingDate.getHours(), 0);
});

test("applies article exclusions to WMS history", () => {
  configureExcludedArticles(["42570"]);
  assert.equal(mapMovementToPickHistoryRecord({ articleNumber: "42570" }), null);
  configureExcludedArticles([]);
});
