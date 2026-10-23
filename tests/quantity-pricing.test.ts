import { test } from "node:test";
import assert from "node:assert/strict";
import {
    priceCart,
    quantityDiscountError,
    quantityDiscounts,
    quantityUnitPrice,
    shippingFee,
    quantityTotalPrice,
    quantityPriceBreakdown,
} from "../packages/shared/src";
const tiers = [
    { minQuantity: 2, unitPrice: 200 },
    { minQuantity: 3, unitPrice: 180 },
];
test("Exact overrides are honoured while other quantities repeat the smallest configured pack", () => {
    for (const [quantity, price] of [
        [1, 230],
        [2, 200],
        [3, 180],
        [4, 200],
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

test("Pack totals preserve exact cents across variants and snapshot allocations", () => {
    const offers = [
        { minQuantity: 2, unitPrice: 190, totalPrice: 380 },
        { minQuantity: 3, unitPrice: 500 / 3, totalPrice: 500 },
    ];
    assert.equal(quantityDiscountError(200, offers), null);
    assert.equal(
        quantityDiscountError(200, [{ minQuantity: 2, unitPrice: 200, totalPrice: 400 }]),
        null,
        "a standard quantity total is allowed",
    );
    for (const [quantity, total] of [
        [1, 200],
        [2, 380],
        [3, 500],
        [4, 760],
        [5, 960],
        [6, 1140],
    ])
        assert.equal(quantityTotalPrice(200, offers, quantity), total);
    for (let quantity = 1; quantity <= 100; quantity++) {
        const rows = Array.from({ length: quantity }, (_, i) => ({
            productId: "a",
            price: 200,
            quantityDiscounts: offers,
            quantity: 1,
            variantId: i % 2,
        }));
        const grouped = priceCart([{ ...rows[0], quantity }]);
        const split = priceCart(rows);
        assert.equal(split.subtotal, grouped.subtotal);
        assert.equal(split.subtotal, quantityTotalPrice(200, offers, quantity));
        const parts = grouped.lines.flatMap((l) => l.allocations);
        assert.equal(
            parts.reduce((sum, p) => sum + p.quantity, 0),
            quantity,
        );
        assert.equal(
            parts.reduce((sum, p) => sum + Math.round(p.unitPrice * 100) * p.quantity, 0),
            Math.round(grouped.subtotal * 100),
        );
        assert.ok(
            parts.every((p) => Number.isInteger(Math.round(p.unitPrice * 100)) && p.unitPrice > 0),
        );
    }
    for (const bad of [
        [{ minQuantity: 3, unitPrice: 166, totalPrice: 500 }],
        [{ minQuantity: 3, unitPrice: 500.001 / 3, totalPrice: 500.001 }],
        [{ minQuantity: 3, unitPrice: 0.02 / 3, totalPrice: 0.02 }],
        [{ minQuantity: 2, unitPrice: 201, totalPrice: 402 }],
    ])
        assert.ok(quantityDiscountError(200, bad));
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
        54.65,
    );
});
test("Independent offers may have different unit rates but cannot exceed the ordinary total", () => {
    const independent = [
        { minQuantity: 2, unitPrice: 190, totalPrice: 380 },
        { minQuantity: 3, unitPrice: 210, totalPrice: 630 },
    ];
    assert.equal(quantityDiscountError(230, independent), null);
    assert.equal(quantityTotalPrice(230, independent, 2), 380);
    assert.equal(quantityTotalPrice(230, independent, 3), 630);
    assert.equal(quantityTotalPrice(230, independent, 4), 760);
});
test("Pairs repeat with full-price odd pieces, unless that exact quantity has a special total", () => {
    const pair = [{ minQuantity: 2, unitPrice: 200, totalPrice: 400 }];
    for (let quantity = 1; quantity <= 101; quantity++) {
        const expected = Math.floor(quantity / 2) * 400 + (quantity % 2) * 230;
        assert.equal(quantityTotalPrice(230, pair, quantity), expected);
        assert.equal(
            quantityTotalPrice(230, [{ minQuantity: 2, unitPrice: 200 }], quantity),
            expected,
        );
        const result = quantityPriceBreakdown(230, pair, quantity);
        assert.equal(result.looseQuantity, quantity % 2);
        assert.equal(
            result.allocations.reduce((n, part) => n + part.quantity, 0),
            quantity,
        );
        if (quantity % 2) assert.equal(result.allocations.at(-1)?.unitPrice, 230);
    }
    assert.equal(quantityTotalPrice(230, pair, 1_000_001), 200_000_230);
    const overrides = [
        ...pair,
        { minQuantity: 3, totalPrice: 650, unitPrice: 650 / 3 },
        { minQuantity: 4, totalPrice: 700, unitPrice: 175 },
    ];
    assert.equal(
        quantityTotalPrice(230, overrides, 3),
        650,
        "exact merchant price wins even over a cheaper pair + remainder",
    );
    assert.equal(quantityTotalPrice(230, overrides, 4), 700);
    assert.equal(
        quantityTotalPrice(230, overrides, 5),
        1030,
        "without an exact override, repeat the smallest pack",
    );
    const line = priceCart([{ productId: "a", price: 230, quantityDiscounts: pair, quantity: 3 }])
        .lines[0];
    assert.equal(line.total, 630);
    assert.deepEqual(line.allocations, [
        { quantity: 2, unitPrice: 200 },
        { quantity: 1, unitPrice: 230 },
    ]);
});
test("Invalid schedules are rejected, including duplicates, excessive prices and fractions of a cent", () => {
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
        Array.from({ length: 6 }, (_, i) => ({ minQuantity: i + 2, unitPrice: 200 - i })),
    ])
        assert.ok(quantityDiscountError(230, bad), JSON.stringify(bad));
});
