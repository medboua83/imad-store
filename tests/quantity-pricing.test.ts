import { test } from "node:test";
import assert from "node:assert/strict";
import {
    priceCart,
    quantityDiscountError,
    quantityDiscounts,
    quantityUnitPrice,
    shippingFee,
} from "../packages/shared/src";
const tiers = [
    { minQuantity: 2, unitPrice: 200 },
    { minQuantity: 3, unitPrice: 180 },
];
test("Quantity pricing uses the highest reached tier without stacking and falls back for legacy products", () => {
    for (const [quantity, price] of [
        [1, 230],
        [2, 200],
        [3, 180],
        [4, 180],
    ])
        assert.equal(quantityUnitPrice(230, tiers, quantity), price);
    assert.equal(quantityUnitPrice(230, undefined, 3), 230);
    assert.equal(quantityUnitPrice(230, null, 3), 230);
    assert.equal(
        quantityUnitPrice(190, tiers, 3),
        190,
        "invalid stale schedule cannot raise the current price",
    );
    assert.deepEqual(quantityDiscounts(230, [...tiers].reverse()), tiers);
});
test("Variant quantities combine only within the same product, and removing a unit removes the discount", () => {
    const item = { productId: "a", price: 230, quantityDiscounts: tiers, quantity: 1 };
    const mixed = priceCart([
        item,
        { ...item },
        { ...item, productId: "b", quantityDiscounts: [] },
    ]);
    assert.deepEqual(
        mixed.lines.map((l) => l.unitPrice),
        [200, 200, 230],
    );
    assert.equal(mixed.subtotal, 630);
    assert.equal(mixed.savings, 60);
    assert.equal(priceCart([item]).subtotal, 230);
    assert.equal(priceCart([{ ...item, quantity: 3 }]).subtotal, 540);
    assert.equal(priceCart([item, { ...item, productId: "b" }]).savings, 0);
    const settings = { shippingCost: 30, freeShippingMin: 450 };
    assert.equal(
        shippingFee(priceCart([item, item]).subtotal, [{ quantity: 2 }], settings),
        30,
        "threshold uses the discounted subtotal",
    );
    assert.equal(
        priceCart([
            {
                ...item,
                price: 19.99,
                quantityDiscounts: [{ minQuantity: 2, unitPrice: 17.33 }],
                quantity: 3,
            },
        ]).subtotal,
        51.99,
    );
});
test("Invalid schedules are rejected, including duplicates, rising prices and fractions of a cent", () => {
    for (const bad of [
        [{ minQuantity: 1, unitPrice: 200 }],
        [{ minQuantity: 2.5, unitPrice: 200 }],
        [{ minQuantity: 101, unitPrice: 200 }],
        [{ minQuantity: 2, unitPrice: 230 }],
        [{ minQuantity: 2, unitPrice: 0 }],
        [{ minQuantity: 2, unitPrice: 200.001 }],
        [
            { minQuantity: 2, unitPrice: 200 },
            { minQuantity: 2, unitPrice: 190 },
        ],
        [
            { minQuantity: 2, unitPrice: 200 },
            { minQuantity: 3, unitPrice: 210 },
        ],
        Array.from({ length: 6 }, (_, i) => ({ minQuantity: i + 2, unitPrice: 200 - i })),
    ])
        assert.ok(quantityDiscountError(230, bad), JSON.stringify(bad));
});
