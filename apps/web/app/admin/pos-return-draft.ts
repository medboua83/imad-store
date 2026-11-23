import type { ReturnBody, ReturnReceipt } from "@/lib/pos-returns-api";
export type ReturnAttempt = {
  key: string;
  body: ReturnBody;
  returnCents: number;
  replacementCents: number;
  netCents: number;
};
export type ReturnDraft = { pending: ReturnAttempt | null; receiptId: string | null };
export const returnStorageKey = (actor: string) => "imad-pos-returns-v1:" + actor;
const id = (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/.test(v);
const cents = (v: unknown) =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 2_000_000_000;
export function parseReturnDraft(raw: string | null): ReturnDraft {
  if (!raw) return { pending: null, receiptId: null };
  const p = JSON.parse(raw),
    b = p?.pending?.body;
  if (!p || (p.receiptId !== null && !id(p.receiptId)) || (p.pending && p.receiptId))
    throw new Error("Invalid return draft");
  if (
    p.pending &&
    (!b ||
      !id(b.sourceId) ||
      !["SALE", "EXCHANGE"].includes(b.sourceKind) ||
      !id(b.cashSessionId) ||
      !/^[a-f0-9]{64}$/.test(b.quoteHash) ||
      !Array.isArray(b.returns) ||
      !b.returns.length ||
      b.returns.length > 100 ||
      b.returns.some(
        (i: ReturnBody["returns"][number]) =>
          !id(i.itemId) ||
          !Number.isInteger(i.quantity) ||
          i.quantity < 1 ||
          i.quantity > 1000 ||
          typeof i.restock !== "boolean",
      ) ||
      !Array.isArray(b.replacements) ||
      b.replacements.length > 100 ||
      b.replacements.some(
        (i: ReturnBody["replacements"][number]) =>
          !id(i.variantId) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 1000,
      ) ||
      !["CASH", "CARD_TERMINAL", "NONE"].includes(b.paymentMethod) ||
      !cents(b.receivedCents) ||
      typeof b.note !== "string" ||
      b.note.length > 500 ||
      typeof p.pending.key !== "string" ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(p.pending.key) ||
      !cents(p.pending.returnCents) ||
      !cents(p.pending.replacementCents) ||
      p.pending.netCents !== p.pending.replacementCents - p.pending.returnCents)
  )
    throw new Error("Invalid return attempt");
  return { pending: p.pending ?? null, receiptId: p.receiptId ?? null };
}
export function assertReturn(r: ReturnReceipt, p: ReturnAttempt, actor: string) {
  const b = p.body;
  if (
    !r ||
    !id(r.id) ||
    r.currency !== "MAD" ||
    r.cashierId !== actor ||
    r.cashSessionId !== b.cashSessionId ||
    r.sourceSaleId !== (b.sourceKind === "SALE" ? b.sourceId : null) ||
    r.sourceAdjustmentId !== (b.sourceKind === "EXCHANGE" ? b.sourceId : null) ||
    r.paymentMethod !== b.paymentMethod ||
    r.receivedCents !== b.receivedCents ||
    r.note !== b.note ||
    r.returnCents !== p.returnCents ||
    r.replacementCents !== p.replacementCents ||
    r.netCents !== p.netCents ||
    r.changeCents !== (p.netCents > 0 ? b.receivedCents - p.netCents : 0) ||
    !Array.isArray(r.items)
  )
    throw new Error("Unconfirmed return receipt");
  const returned = r.items.filter((i) => i.kind === "RETURN"),
    replacements = r.items.filter((i) => i.kind === "REPLACEMENT");
  if (
    returned.length !== b.returns.length ||
    replacements.length !== b.replacements.length ||
    b.returns.some(
      (i) =>
        !returned.some(
          (r) =>
            r.sourceItemId === i.itemId && r.quantity === i.quantity && r.restock === i.restock,
        ),
    ) ||
    b.replacements.some(
      (i) => !replacements.some((r) => r.variantId === i.variantId && r.quantity === i.quantity),
    ) ||
    returned.reduce((n, i) => n + i.totalCents, 0) !== r.returnCents ||
    replacements.reduce((n, i) => n + i.totalCents, 0) !== r.replacementCents
  )
    throw new Error("Unconfirmed return items");
}
