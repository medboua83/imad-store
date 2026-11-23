import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCashAttempt, assertCashAction } from "../apps/web/app/admin/pos-cash-draft";
import { parsePosDraft } from "../apps/web/app/admin/pos-draft";
const id = "a".repeat(24),
  actor = "b".repeat(24),
  hash = "c".repeat(64);
test("A saved cash operation retains its counted amount and reference and rejects corrupted recovery data", () => {
  const p = {
    kind: "close",
    key: "close_0123456789abcdef",
    body: { sessionId: id, balanceHash: hash, countedCents: 33000, note: "Écart expliqué" },
  };
  assert.deepEqual(parseCashAttempt(JSON.stringify(p)), p);
  assert.equal(parseCashAttempt(null), null);
  for (const broken of [
    { ...p, key: "open_0123456789abcdef" },
    { ...p, body: { ...p.body, sessionId: "foreign" } },
    { ...p, body: { ...p.body, countedCents: 33000.1 } },
    { ...p, body: { ...p.body, balanceHash: "missing" } },
    { ...p, body: { ...p.body, note: "a".repeat(501) } },
  ])
    assert.throws(() => parseCashAttempt(JSON.stringify(broken)));
  const draft = {
    cart: [],
    receiptId: null,
    pending: {
      key: "0123456789abcdef",
      totalCents: 23000,
      body: {
        items: [{ variantId: id, quantity: 1 }],
        quoteHash: hash,
        paymentMethod: "CASH",
        receivedCents: 30000,
        cashSessionId: "bad",
      },
    },
  };
  assert.throws(() => parsePosDraft(JSON.stringify(draft)));
});
test("Recovery cannot accept a different cashier, counted amount or closing snapshot", () => {
  const pending: any = {
    kind: "close",
    key: "close_0123456789abcdef",
    body: { sessionId: id, balanceHash: hash, countedCents: 33000, note: "" },
  };
  const s: any = {
    id,
    cashierId: actor,
    currency: "MAD",
    openingCents: 10000,
    cashCents: 23000,
    expectedCents: 33000,
    balanceHash: hash,
    closing: { countedCents: 33000, differenceCents: 0, note: "" },
  };
  assert.doesNotThrow(() => assertCashAction(s, pending, actor));
  for (const changed of [
    { ...s, cashierId: id },
    { ...s, balanceHash: "d".repeat(64) },
    { ...s, closing: { ...s.closing, countedCents: 33001 } },
    { ...s, closing: { ...s.closing, differenceCents: 100 } },
    { ...s, expectedCents: 50000 },
    { ...s, closing: null },
  ])
    assert.throws(() => assertCashAction(changed, pending, actor));
  const opening: any = {
    kind: "open",
    key: "open_0123456789abcdef",
    body: { openingCents: 10000 },
  };
  assert.doesNotThrow(() => assertCashAction(s, opening, actor));
  assert.throws(() => assertCashAction({ ...s, openingCents: 0 }, opening, actor));
});
