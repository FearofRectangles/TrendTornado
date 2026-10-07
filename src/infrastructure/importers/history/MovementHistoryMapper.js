import { PickHistoryRecord } from "../../../domain/analytics/history/PickHistoryRecord.js";
import { isExcludedArticle } from "../../../domain/analytics/history/PickHistoryRules.js";

export function mapMovementToPickHistoryRecord(movement) {
  if (!movement || isExcludedArticle(movement.articleNumber)) return null;

  return new PickHistoryRecord({
    postingDate: new Date(
      movement.occurredAt.getFullYear(),
      movement.occurredAt.getMonth(),
      movement.occurredAt.getDate(),
    ),
    documentNumber: movement.orderNumber,
    articleNumber: movement.articleNumber,
    pickedQuantity: movement.quantity,
  });
}
