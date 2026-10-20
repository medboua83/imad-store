import { test } from "node:test";
import assert from "node:assert/strict";
import { shippingFee } from "../packages/shared/src/index";
test("Delivery uses discounted subtotal, inclusive threshold, and any eligible line", () => {
    const settings = { shippingCost: 30, freeShippingMin: 500 };
    assert.equal(shippingFee(499.99, [{ quantity: 1 }], settings), 30);
    assert.equal(shippingFee(500, [{ quantity: 1 }], settings), 0);
    assert.equal(
        shippingFee(100, [{ quantity: 1 }, { quantity: 1, freeShipping: true }], settings),
        0,
    );
    assert.equal(
        shippingFee(100, [{ quantity: 1 }, { quantity: 0, freeShipping: true }], settings),
        30,
    );
    assert.equal(shippingFee(100, [{ quantity: 1 }], { ...settings, freeShippingMin: 0 }), 0);
});
