import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReturnDraft, assertReturn } from "../apps/web/app/admin/pos-return-draft";
const id = "a".repeat(24),
  actor = "b".repeat(24),
  item = "c".repeat(24),
  session = "d".repeat(24);
const pending: any = {
  key: "return_test_123456789",
  body: {
    sourceKind: "SALE",
    sourceId: id,
    returns: [{ itemId: item, quantity: 1, restock: true }],
    replacements: [],
    quoteHash: "a".repeat(64),
    cashSessionId: session,
    paymentMethod: "CASH",
    receivedCents: 0,
    note: "Fictif",
  },
  returnCents: 23000,
  replacementCents: 0,
  netCents: -23000,
};
const receipt: any = {
  id: "e".repeat(24),
  cashierId: actor,
  cashSessionId: session,
  currency: "MAD",
  sourceSaleId: id,
  sourceAdjustmentId: null,
  returnCents: 23000,
  replacementCents: 0,
  netCents: -23000,
  paymentMethod: "CASH",
  receivedCents: 0,
  changeCents: 0,
  note: "Fictif",
  items: [{ sourceItemId: item, kind: "RETURN", quantity: 1, restock: true, totalCents: 23000 }],
};
test("Return drafts retain one attempt or a confirmed receipt; malformed choices cannot become restock", () => {
  assert.deepEqual(parseReturnDraft(null), { pending: null, receiptId: null });
  assert.deepEqual(parseReturnDraft(JSON.stringify({ pending, receiptId: null })).pending, pending);
  for (const mutate of [
    (p: any) => delete p.body.returns[0].restock,
    (p: any) => (p.body.returns[0].quantity = -1),
    (p: any) => (p.body.quoteHash = "bad"),
    (p: any) => (p.netCents = 1),
  ]) {
    const p = structuredClone(pending);
    mutate(p);
    assert.throws(() => parseReturnDraft(JSON.stringify({ pending: p, receiptId: null })));
  }
  assert.throws(() => parseReturnDraft(JSON.stringify({ pending, receiptId: id })));
});
test("A response from another cashier, source, stock choice or amount can never clear a pending refund", () => {
  assertReturn(receipt, pending, actor);
  for (const mutate of [
    (r: any) => (r.cashierId = id),
    (r: any) => (r.sourceSaleId = item),
    (r: any) => (r.netCents = -1),
    (r: any) => (r.items[0].restock = false),
    (r: any) => (r.items[0].quantity = 2),
    (r: any) => (r.cashSessionId = id),
  ]) {
    const r = structuredClone(receipt);
    mutate(r);
    assert.throws(() => assertReturn(r, pending, actor));
  }
});
