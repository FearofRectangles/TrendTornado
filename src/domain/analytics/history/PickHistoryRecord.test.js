import test from "node:test";
import assert from "node:assert/strict";

import { PickHistoryRecord } from "./PickHistoryRecord.js";

test("creates a valid history record", () => {

    const record = new PickHistoryRecord({
        postingDate: new Date("2026-08-30"),
        documentNumber: "UT121519195",
        articleNumber: "114022",
        pickedQuantity: 5,
    });

    assert.equal(record.articleNumber, "114022");
    assert.equal(record.pickedQuantity, 5);

});

test("rejects negative quantity", () => {

    assert.throws(() => {

        new PickHistoryRecord({
            postingDate: new Date(),
            documentNumber: "UT1",
            articleNumber: "1000",
            pickedQuantity: -5,
        });

    });

});