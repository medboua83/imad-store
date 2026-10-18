import test from "node:test";
import assert from "node:assert/strict";
import { summarize, filterOrders } from "../apps/web/app/admin/admin-utils";
test("Admin summary separates delivered amounts from pending and cancelled orders without invented margin", () => {
    const summary = summarize(
        [
            { status: "DELIVERED", totalAmount: 130 },
            { status: "PENDING", totalAmount: 400 },
            { status: "CANCELLED", totalAmount: 900 },
        ],
        [
            { status: "ACTIVE", variants: [{ stock: 8 }, { stock: 2 }] },
            { status: "DRAFT", variants: [{ stock: 0 }] },
        ],
    );
    assert.equal(summary.deliveredAmount, 130);
    assert.equal(summary.pending, 1);
    assert.equal(summary.activeProducts, 1);
    assert.equal(summary.lowStock, 1);
    assert.deepEqual(summarize([], []), {
        pending: 0,
        deliveredAmount: 0,
        activeProducts: 0,
        lowStock: 0,
    });
});
test("Order search handles formatted phone numbers, city and references while retaining status filter", () => {
    const orders = [
        {
            id: "abc123",
            customerName: "Essai commande",
            customerPhone: "+212 600-001-019",
            city: "Rabat",
            status: "PENDING",
        },
        { id: "def456", customerName: null, customerPhone: null, city: null, status: "CANCELLED" },
    ];
    assert.equal(filterOrders(orders, "+212600001019", "ALL")[0]?.id, "abc123");
    assert.equal(filterOrders(orders, " rabat ", "PENDING").length, 1);
    assert.equal(filterOrders(orders, "ABC123", "CANCELLED").length, 0);
    assert.equal(filterOrders(orders, "DEF456", "ALL")[0]?.id, "def456");
    assert.equal(filterOrders(orders, "inconnu", "ALL").length, 0);
});
