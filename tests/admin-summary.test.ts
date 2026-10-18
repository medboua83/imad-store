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

import { orderAmounts, orderDay, refineOrders } from "../apps/web/app/admin/order-utils";
import type { AdminOrder } from "../apps/web/src/lib/api";
const fixture = (id: string, createdAt: string, totalAmount: number, paymentStatus = "PENDING"): AdminOrder => ({ id, createdAt, totalAmount, paymentStatus, customerName: null, customerPhone: null, city: null, region: null, status: "PENDING", paymentMethod: "COD" });
test("Order filters include both local date boundaries, combine payment and do not reorder source data", () => {
    const orders = [fixture("new", "2026-10-18T23:30:00Z", 300), fixture("old", "2026-10-17T23:30:00Z", 200, "PAID"), fixture("older", "2026-10-16T12:00:00Z", 400)];
    assert.equal(orderDay(orders[0].createdAt), "2026-10-19");
    assert.deepEqual(refineOrders(orders, "PAID", "2026-10-18", "2026-10-18", "newest").map(o=>o.id), ["old"]);
    assert.deepEqual(refineOrders(orders, "ALL", "", "", "amount").map(o=>o.id), ["older", "new", "old"]);
    assert.deepEqual(refineOrders(orders, "ALL", "", "", "oldest").map(o=>o.id), ["older", "old", "new"]);
    assert.deepEqual(orders.map(o=>o.id), ["new", "old", "older"]);
});
test("Order breakdown uses recorded unit prices and explicitly detects incomplete or inconsistent totals", () => {
    const order = { ...fixture("sample", "2026-10-18T10:00:00Z", 230), shippingCost: 30, items: [{ id:"line", quantity:2, unitPrice:100, product:{nameFr:"Produit actuel"} }] };
    assert.deepEqual(orderAmounts(order), { subtotal:200, shipping:30, reconciled:true });
    assert.equal(orderAmounts({...order,totalAmount:240}).reconciled,false);
    assert.equal(orderAmounts({...order,items:undefined}).reconciled,false);
    assert.equal(orderAmounts({...order,shippingCost:undefined}).reconciled,false);
});
