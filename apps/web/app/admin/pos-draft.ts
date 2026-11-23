import type { PosItem, PosBody, PosReceipt } from "@/lib/pos-api";
export type CartRow = PosItem & { label: string };
export type PendingSale = { key: string; body: PosBody; totalCents: number };
export type PosDraft = { cart: CartRow[]; pending: PendingSale | null; receiptId: string | null };
export const emptyPosDraft = (): PosDraft => ({ cart: [], pending: null, receiptId: null });
const id = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/.test(v);
const cents = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 2_000_000_000;
export function parsePosDraft(raw: string | null): PosDraft {
  if (!raw) return emptyPosDraft();
  const d = JSON.parse(raw);
  if (
    !d ||
    !Array.isArray(d.cart) ||
    d.cart.length > 100 ||
    d.cart.some(
      (i: CartRow) =>
        !id(i.variantId) ||
        !Number.isSafeInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 1000 ||
        typeof i.label !== "string" ||
        i.label.length > 500,
    ) ||
    (d.receiptId !== null && !id(d.receiptId))
  )
    throw new Error("Invalid draft");
  if (d.pending !== null) {
    const p = d.pending,
      b = p?.body;
    if (
      !p ||
      typeof p.key !== "string" ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(p.key) ||
      !cents(p.totalCents) ||
      !b ||
      !Array.isArray(b.items) ||
      !b.items.length ||
      b.items.length > 100 ||
      b.items.some(
        (i: PosItem) =>
          !id(i.variantId) ||
          !Number.isSafeInteger(i.quantity) ||
          i.quantity < 1 ||
          i.quantity > 1000,
      ) ||
      typeof b.quoteHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(b.quoteHash) ||
      !["CASH", "CARD_TERMINAL"].includes(b.paymentMethod) ||
      !cents(b.receivedCents)
    )
      throw new Error("Invalid pending sale");
  }
  if (d.pending && d.receiptId) throw new Error("Conflicting sale state");
  return d;
}
/** An uncertain attempt stays frozen across tab switches, reloads and password changes. */
export function storePosDraft(
  key: string,
  draft: PosDraft,
  storage: Pick<Storage, "setItem" | "getItem">,
) {
  const raw = JSON.stringify(draft);
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error("Sale could not be retained");
}
export function assertPosReceipt(sale: PosReceipt, pending: PendingSale, actorId: string) {
  const expected = new Map<string, number>();
  for (const i of pending.body.items)
    expected.set(i.variantId, (expected.get(i.variantId) ?? 0) + i.quantity);
  if (
    !sale ||
    !id(sale.id) ||
    sale.currency !== "MAD" ||
    sale.cashierId !== actorId ||
    sale.paymentMethod !== pending.body.paymentMethod ||
    sale.totalCents !== pending.totalCents ||
    sale.receivedCents !== pending.body.receivedCents ||
    sale.changeCents !== sale.receivedCents - sale.totalCents ||
    !Array.isArray(sale.items) ||
    sale.items.length !== expected.size ||
    new Set(sale.items.map((i) => i.variantId)).size !== sale.items.length ||
    sale.items.some((i) => expected.get(i.variantId) !== i.quantity) ||
    sale.items.reduce((s, i) => s + i.totalCents, 0) !== sale.totalCents
  )
    throw new Error("Unconfirmed receipt");
}
export function cashInputCents(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit <= "٩" ? 0x660 : 0x6f0)))
    .replace(/٫/g, ".");
  if (!/^\d{1,8}(?:[.,]\d{0,2})?$/.test(normalized)) return null;
  const n = Math.round(Number(normalized.replace(",", ".")) * 100);
  return cents(n) ? n : null;
}

/** Compare checkout intent, ignoring labels and the order of variants. */
export function samePosItems(a: readonly PosItem[], b: readonly PosItem[]): boolean {
  const canonical = (items: readonly PosItem[]) => {
    const sum = new Map<string, number>();
    for (const item of items)
      sum.set(item.variantId, (sum.get(item.variantId) ?? 0) + item.quantity);
    return JSON.stringify([...sum].sort(([a], [b]) => a.localeCompare(b)));
  };
  return canonical(a) === canonical(b);
}
