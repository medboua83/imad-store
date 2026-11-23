import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cashInputCents,
  parsePosDraft,
  storePosDraft,
  assertPosReceipt,
} from "../apps/web/app/admin/pos-draft";
const variantId = "1".repeat(24),
  actor = "2".repeat(24);
const pending = {
  key: "recoverable-sale-key",
  totalCents: 23000,
  body: {
    items: [{ variantId, quantity: 1 }],
    quoteHash: "a".repeat(64),
    paymentMethod: "CASH" as const,
    receivedCents: 24000,
  },
};
const sale: any = {
  id: "3".repeat(24),
  currency: "MAD",
  cashierId: actor,
  paymentMethod: "CASH",
  totalCents: 23000,
  receivedCents: 24000,
  changeCents: 1000,
  items: [{ variantId, quantity: 1, totalCents: 23000 }],
};
test("Cash input preserves cents and rejects ambiguous, negative or excessive tender", () => {
  for (const [s, n] of [
    ["230", 23000],
    ["240,50", 24050],
    [" 0.01 ", 1],
    ["0", 0],
  ] as const)
    assert.equal(cashInputCents(s), n);
  for (const s of ["1e5", "-20", "Infinity", "230.001", "20 000", "230,1.0", "99999999", ""])
    assert.equal(cashInputCents(s), null);
});
test("Pending attempts restore exactly and corrupt drafts cannot silently become new sales", () => {
  const draft = { cart: [{ variantId, quantity: 1, label: "Article" }], pending, receiptId: null };
  assert.deepEqual(parsePosDraft(JSON.stringify(draft)), draft);
  for (const d of [
    { ...draft, receiptId: "4".repeat(24) },
    { ...draft, pending: { ...pending, key: "short" } },
    { ...draft, cart: [{ variantId, quantity: -1, label: "bad" }] },
    { ...draft, pending: { ...pending, body: { ...pending.body, receivedCents: -1 } } },
  ])
    assert.throws(() => parsePosDraft(JSON.stringify(d)));
  assert.throws(() => parsePosDraft("{"));
});
test("A browser storage failure prevents treating a payment attempt as safely retained", () => {
  let raw: string | null = null;
  const store = {
    setItem: (_key: string, value: string) => {
      raw = value;
    },
    getItem: () => raw,
  };
  const draft = { cart: [], pending, receiptId: null };
  storePosDraft("cashier", draft, store);
  assert.deepEqual(parsePosDraft(raw), draft);
  assert.throws(() => storePosDraft("cashier", draft, { setItem: () => {}, getItem: () => null }));
});
test("Recovery verifies actor, amounts, payment, quantities and distinct variant lines before unfreezing", () => {
  assertPosReceipt(sale, pending, actor);
  for (const changed of [
    { ...sale, cashierId: "4".repeat(24) },
    { ...sale, totalCents: 1 },
    { ...sale, paymentMethod: "CARD_TERMINAL" },
    { ...sale, items: [{ ...sale.items[0], quantity: 2 }] },
    { ...sale, changeCents: 0 },
  ])
    assert.throws(() => assertPosReceipt(changed, pending, actor));
  const two = {
    ...pending,
    totalCents: 46000,
    body: {
      ...pending.body,
      receivedCents: 46000,
      items: [
        { variantId, quantity: 1 },
        { variantId: "5".repeat(24), quantity: 1 },
      ],
    },
  };
  assert.throws(() =>
    assertPosReceipt(
      {
        ...sale,
        totalCents: 46000,
        receivedCents: 46000,
        changeCents: 0,
        items: [sale.items[0], sale.items[0]],
      },
      two,
      actor,
    ),
  );
});
