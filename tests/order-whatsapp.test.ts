import { test } from "node:test";
import assert from "node:assert/strict";
import { orderWhatsAppLink } from "../apps/web/app/admin/order-whatsapp";
import type { AdminOrder } from "../apps/web/src/lib/api";

const order: AdminOrder = {
    id: "fixture-order", customerName: "Client fictif", customerPhone: "06 12 34 56 78",
    city: "Rabat", region: null, street: "Adresse de test", status: "PENDING",
    paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 240, shippingCost: 40,
    createdAt: "2026-11-17T10:00:00Z",
    items: [{ id: "line", quantity: 2, unitPrice: 100,
        product: { nameFr: "Abaya & été", images: ["/general.webp", "/brown.webp"], colorPhotos: [{ colorKey: "#804000|marron", image: "/brown.webp" }] },
        variant: { color: "#804000", colorNameFr: "Marron", size: "XL", sku: "AB-XL" } }],
};

test("WhatsApp draft preserves purchased details, totals and exact colour photo", () => {
    const url = new URL(orderWhatsAppLink(order, "https://imadmode.com")!);
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/212612345678");
    const text = url.searchParams.get("text")!;
    for (const value of ["Abaya & été", "الإسم : Client fictif", "المقاس : XL", "اللون : Marron", "الكمية : 2", "240,00", "40,00", "https://imadmode.com/brown.webp"]) assert.ok(text.includes(value), value);
    assert.ok(!text.includes("general.webp"));
    assert.ok(!text.includes("/admin"));
    assert.ok(!text.includes("AB-XL"));
    assert.ok(text.indexOf("ثمن المنتجات") < text.indexOf("ثمن التوصيل"));
    assert.ok(text.indexOf("ثمن التوصيل") < text.indexOf("المجموع"));
    assert.equal(order.status, "PENDING");
});

test("Missing delivery fees are not invented; free delivery stays zero", () => {
    const text = new URL(orderWhatsAppLink({ ...order, shippingCost: undefined }, "https://imadmode.com")!).searchParams.get("text")!;
    assert.ok(text.includes("ثمن التوصيل : غير محدد"));
    assert.ok(text.includes("يرجى التحقق"));
    const free = new URL(orderWhatsAppLink({ ...order, shippingCost: 0, totalAmount: 200 }, "https://imadmode.com")!).searchParams.get("text")!;
    assert.ok(free.includes("ثمن التوصيل : 0,00"));
    assert.ok(!free.includes("يرجى التحقق"));
});

test("Legacy contact/address fallbacks and international phones; malformed phones have no link", () => {
    for (const phone of ["+212612345678", "00212612345678", "212612345678"]) {
        assert.equal(new URL(orderWhatsAppLink({ ...order, customerPhone: phone }, "https://imadmode.com")!).pathname, "/212612345678");
    }
    for (const phone of ["", "not a number", "123", "https://example.com"]) assert.equal(orderWhatsAppLink({ ...order, customerPhone: phone }, "https://imadmode.com"), null);
    const link = orderWhatsAppLink({ ...order, customerPhone: null, city: null, street: null, items: [], address: { phone: "+33612345678", street: "Rue fictive", city: "Paris" } }, "https://imadmode.com")!;
    assert.equal(new URL(link).pathname, "/33612345678");
    assert.ok(new URL(link).searchParams.get("text")!.includes("تفاصيل المنتجات غير متوفرة"));
});

test("Every article is included, optional variants stay absent and invalid photo schemes are omitted", () => {
    const link = orderWhatsAppLink({ ...order, items: [...order.items!, {
        id: "second", quantity: 1, unitPrice: 25,
        product: { nameFr: "Sac test", images: ["javascript:alert(1)"] },
    }] }, "https://imadmode.com")!;
    const text = new URL(link).searchParams.get("text")!;
    assert.ok(text.includes("Sac test"));
    assert.ok(text.includes("الكمية : 1"));
    assert.equal(text.split("المقاس :").length, 2);
    assert.ok(!text.includes("javascript:"));
});

test("Confirmed/site orders coordinate delivery without asking to confirm the order again", () => {
    for (const patch of [{confirmationMethod:"SITE"}, {status:"CONFIRMED"}, {status:"SHIPPED"}, {status:"DELIVERED"}, {status:"CANCELLED", confirmationMethod:"SITE"}]) {
        const text = new URL(orderWhatsAppLink({...order,...patch}, "https://imadmode.com")!).searchParams.get("text")!;
        assert.ok(!text.includes("هل تؤكدون الطلب"));
        if (patch.status === "CANCELLED") assert.ok(text.includes("هذا الطلب ملغى"));
        else if (patch.status === "SHIPPED") assert.ok(text.includes("تم شحن طلبكم"));
        else if (patch.status === "DELIVERED") assert.ok(text.includes("كمُسلَّم"));
        else assert.ok(text.includes("طلبكم مؤكد"));
    }
    const pending = new URL(orderWhatsAppLink(order,"https://imadmode.com")!).searchParams.get("text")!;
    assert.ok(pending.includes("هل تؤكدون الطلب"));
});
