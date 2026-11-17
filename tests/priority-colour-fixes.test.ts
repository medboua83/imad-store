import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogColorValues } from "../packages/shared/src/product-color-photos";
import { distinctColorLabels } from "../apps/web/src/lib/product-presentation";

test("Colour families retain exact values and normalize beige spelling", () => {
    assert.deepEqual(distinctColorLabels([
        { value: "#111111", label: "باج غامق" },
        { value: "#222222", label: "بيج غامق" },
        { value: "#333333", label: "بيج فاتح" },
    ]), [
        { value: "group:#111111,#222222", label: "بيج غامق" },
        { value: "#333333", label: "بيج فاتح" },
    ]);
    assert.deepEqual(catalogColorValues("#111111"), ["#111111"]);
    assert.deepEqual(catalogColorValues("group:#111111,#222222"), ["#111111", "#222222"]);
});

test("Grouped colours reject malformed and unbounded filters", () => {
    for (const value of ["", "group:#111111", "group:#111111,", "group:#111111,%", "group:" + Array(101).fill("#111111").join(","), "x".repeat(81)])
        assert.equal(catalogColorValues(value), undefined);
    assert.deepEqual(catalogColorValues("%_"), ["%_"]);
});
