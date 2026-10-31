import { test } from "node:test";
import assert from "node:assert/strict";
import { cartStorage, recoverCart } from "../apps/web/src/lib/cart-recovery";
const item = {
  productId: "111111111111111111111111",
  variantId: "222222222222222222222222",
  productSlug: "test-shoe",
  price: 230,
  quantity: 3,
  stock: 5,
  nameFr: "Chaussure",
  nameAr: "حذاء",
  nameEn: "Shoe",
  size: "40",
  colorNameFr: "Noir",
  colorNameAr: "أسود",
  colorNameEn: "Black",
  image: "/images/catalogue-test/sac.webp",
  freeShipping: true,
  quantityDiscounts: [{ minQuantity: 2, unitPrice: 200, totalPrice: 400 }],
};
test("Restoring a valid legacy basket preserves quantities, variants, prices and offers", () => {
  const result = recoverCart({ items: [item], isOpen: true });
  assert.equal(result.recovered, false);
  assert.deepEqual(result.items, [{ ...item, images: [item.image] }]);
});
test("Malformed top-level saved state cannot reach pricing or overwrite store methods", () => {
  assert.deepEqual(recoverCart(undefined), { items: [], recovered: false });
  for (const saved of [null, [], "bad", {}, { items: null }, { items: "bad" }, { items: {} }])
    assert.deepEqual(recoverCart(saved), { items: [], recovered: true });
});
test("One damaged row and duplicate variants never discard other valid items", () => {
  const other = { ...item, variantId: "333333333333333333333333", size: "42" };
  const result = recoverCart({ items: [item, null, { ...item, quantity: "2" }, item, other] });
  assert.equal(result.recovered, true);
  assert.deepEqual(
    result.items.map((i) => [i.variantId, i.quantity]),
    [
      [item.variantId, 3],
      [other.variantId, 3],
    ],
  );
});
test("Non-finite amounts, fractional quantities and invalid references are rejected", () => {
  for (const invalid of [
    { price: NaN },
    { price: Infinity },
    { quantity: 1.5 },
    { quantity: -1 },
    { stock: -1 },
    { productId: "bad" },
    { productSlug: "//elsewhere" },
  ])
    assert.deepEqual(recoverCart({ items: [{ ...item, ...invalid }] }), {
      items: [],
      recovered: true,
    });
  const result = recoverCart({ items: [{ ...item, quantity: 0, stock: 0 }] });
  assert.equal(result.items.length, 1, "An unavailable line stays visible for customer review");
});
test("Broken optional media and offers are recoverable without a broken image or crash", () => {
  const result = recoverCart({
    items: [{ ...item, images: [null, {}, "javascript:bad"], quantityDiscounts: [null] }],
  });
  assert.deepEqual(result.items[0].images, [item.image]);
  assert.deepEqual(result.items[0].quantityDiscounts, []);
});
test("Invalid JSON, envelopes and unsupported versions expose a recoverable empty state", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const raw of ["{broken", "[]", '{"state":null}', '{"state":{"items":[]},"version":999}']) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { localStorage: { getItem: () => raw } },
      });
      const saved = JSON.parse((await cartStorage.getItem("test"))!);
      assert.equal(recoverCart(saved.state).recovered, true);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete (globalThis as any).window;
  }
});
test("Unavailable browser storage never prevents using an in-memory basket", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        get localStorage() {
          throw Error("Storage blocked");
        },
      },
    });
    assert.doesNotThrow(() => cartStorage.setItem("test", "{}"));
    assert.doesNotThrow(() => cartStorage.removeItem("test"));
    const saved = JSON.parse((await cartStorage.getItem("test"))!);
    assert.equal(recoverCart(saved.state).recovered, true);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete (globalThis as any).window;
  }
});
