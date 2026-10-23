import { test } from "node:test";
import assert from "node:assert/strict";
import { shippingFee } from "../packages/shared/src/index";
import {
  SHIPPING_CITIES,
  canonicalShippingCity,
  normalizeShippingPhone,
} from "../packages/shared/src/shipping-address";
import { checkoutDeliverySchema } from "../backend/src/lib/checkout-shipping";
import { packagePayload } from "../backend/src/lib/olivraison-api";
test("checkout cities use the official carrier catalogue, explicit aliases and no guessed district", () => {
  assert.equal(SHIPPING_CITIES.length, new Set(SHIPPING_CITIES).size);
  for (const city of ["Tanger", "طنجة", "Tangier", " tangier "])
    assert.equal(canonicalShippingCity(city), "tangier");
  for (const city of ["", "Tangie", "Gueliz", "ville inexistante"])
    assert.equal(canonicalShippingCity(city), null);
  assert.equal(canonicalShippingCity("الرباط"), "rabat");
  assert.equal(normalizeShippingPhone("06 00 00 00 99"), "+212600000099");
  for (const phone of ["0600000000", "123", "+33600000099", "06000000099"])
    assert.equal(normalizeShippingPhone(phone), null);
});
test("the validated checkout maps unchanged address, name, phone and COD total into the carrier form", () => {
  const customer = {
    fullName: "Cliente fictive",
    street: "Rue fictive 11, numero 1",
    phone: "0600000099",
    city: "طنجة",
  };
  const delivery = checkoutDeliverySchema.parse({ customer }).customer;
  const payload = packagePayload(
    {
      id: "isolated-carrier-fixture",
      ...delivery,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      totalAmount: 329,
      items: [{ quantity: 1, product: { nameFr: "Robe fictive" } }],
    },
    delivery.city,
    {},
  );
  assert.deepEqual(payload.destination, {
    name: customer.fullName,
    phone: "+212600000099",
    streetAddress: customer.street,
    city: "tangier",
  });
  assert.equal(payload.price, 329);
  for (const invalid of [
    { fullName: "AB" },
    { street: "A".repeat(125) },
    { city: "inconnue" },
    { phone: "0600000000" },
  ]) {
    const result = checkoutDeliverySchema.safeParse({ customer: { ...customer, ...invalid } });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.issues[0].path[0], "customer");
  }
  assert.equal(
    checkoutDeliverySchema.parse({ customer: { ...customer, street: "A".repeat(124) } }).customer
      .street.length,
    124,
  );
});
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
