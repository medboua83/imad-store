import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCarrierClient,
  documentUrl,
  packagePayload,
  resolveCity,
  CarrierError,
} from "../backend/src/lib/olivraison-api";
const order = {
  id: "order-unique",
  fullName: "Client Test",
  phone: "+212 600000099",
  street: "Adresse fictive",
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  totalAmount: 130,
  items: [{ quantity: 1, product: { nameFr: "Sac" } }],
};
test("Olivraison uses the saved COD total, stable identity and no second inventory reservation", () => {
  const payload = packagePayload(order, "Rabat", {});
  assert.equal(payload.price, 130);
  assert.equal(payload.orderId, order.id);
  assert.equal(payload.partnerTrackingID, order.id);
  assert.equal(payload.inventory, false);
  assert.equal(payload.destination.phone, "+212600000099");
  assert.deepEqual(payload, packagePayload(order, "Rabat", {}));
  for (const bad of [
    { ...order, totalAmount: NaN },
    { ...order, paymentStatus: "PAID" },
    { ...order, fullName: "a" },
    { ...order, street: "a" },
  ])
    assert.throws(() => packagePayload(bad, "Rabat", {}), CarrierError);
});
test("Olivraison requires an exact unambiguous carrier city, with explicit Arabic mapping", () => {
  assert.equal(resolveCity("rabat", [{ name: "Rabat" }], {}), "Rabat");
  assert.equal(resolveCity("الرباط", [{ name: "Rabat" }], { الرباط: "Rabat" }), "Rabat");
  assert.throws(() => resolveCity("inconnue", [{ name: "Rabat" }], {}), CarrierError);
});
test("Olivraison includes every purchased size, colour, reference, quantity and saved unit price", () => {
  const payload = packagePayload({ ...order, items: [
    { quantity: 2, unitPrice: 100, product: { nameFr: "Abaya" }, variant: { size: "XL", colorNameFr: "Beige", sku: "AB-XL" } },
    { quantity: 1, unitPrice: 50, product: { nameAr: "حقيبة" }, variant: { colorNameAr: "أسود" } },
    { quantity: 1, product: { nameFr: "Accessoire" }, variant: {} },
  ] }, "Rabat", {});
  assert.equal(payload.description, "2 × Abaya · Taille: XL · Couleur: Beige · Réf: AB-XL · Prix unitaire: 100.00 MAD; 1 × حقيبة · Couleur: أسود · Prix unitaire: 50.00 MAD; 1 × Accessoire");
  assert.equal(payload.price, order.totalAmount);
});
test("Olivraison never truncates purchased item details when the description is too long", () => {
  assert.throws(() => packagePayload({ ...order, items: [{quantity: 1, product: {nameFr: "x".repeat(1001)}}] }, "Rabat", {}), CarrierError);
  assert.throws(() => packagePayload({ ...order, items: [] }, "Rabat", {}), CarrierError);
});
test("Olivraison document links cannot escape the fixed HTTPS carrier origin", () => {
  assert.equal(documentUrl("/files/a.pdf"), "https://partners.olivraison.com/files/a.pdf");
  for (const url of [
    "javascript:alert(1)",
    "https://evil.invalid/x",
    "//evil.invalid",
    "https://user@partners.olivraison.com/x",
  ])
    assert.equal(documentUrl(url), null);
});
test("Olivraison client logs in once, uses bearer auth, rate gate and fixed origin", async () => {
  const calls: any[] = [];
  let gates = 0;
  const client = createCarrierClient(
    { apiKey: "test-api", secretKey: "test-secret" },
    async () => {
      gates++;
    },
    (async (url, options) => {
      calls.push({ url, ...options });
      return Response.json(calls.length === 1 ? { token: "isolated-token" } : []);
    }) as typeof fetch,
  );
  await client("/cities");
  await client("/status_list");
  assert.equal(gates, 3);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://partners.olivraison.com/auth/login");
  assert.equal(calls[1].headers.Authorization, "Bearer isolated-token");
  assert.equal(calls[0].redirect, "error");
});
test("Olivraison errors contain no echoed credential or customer payload and 429 is retryable", async () => {
  let count = 0;
  const client = createCarrierClient(
    { apiKey: "hidden", secretKey: "hidden" },
    async () => {},
    (async () =>
      Response.json(++count === 1 ? { token: "t" } : { customer: "private" }, {
        status: count === 1 ? 200 : 429,
      })) as typeof fetch,
  );
  await assert.rejects(
    client("/cities"),
    (err: unknown) =>
      err instanceof CarrierError && err.retryable && err.message === "Olivraison HTTP 429",
  );
});
