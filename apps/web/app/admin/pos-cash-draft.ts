import type { CashSession, CashOpenBody, CashCloseBody } from "@/lib/pos-cash-api";
export type CashAttempt =
  | { kind: "open"; key: string; body: CashOpenBody }
  | { kind: "close"; key: string; body: CashCloseBody };
const id = (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/.test(v);
const cents = (v: unknown) =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 2_000_000_000;
export const cashAttemptKey = (actorId: string) => "imad-pos-cash-v1:" + actorId;
export function parseCashAttempt(raw: string | null): CashAttempt | null {
  if (!raw) return null;
  const p = JSON.parse(raw),
    b = p?.body;
  if (
    !p ||
    !["open", "close"].includes(p.kind) ||
    typeof p.key !== "string" ||
    !new RegExp("^" + p.kind + "_[a-zA-Z0-9_-]{16,120}$").test(p.key) ||
    !b
  )
    throw new Error("Invalid cash operation");
  if (
    p.kind === "open"
      ? !cents(b.openingCents)
      : !id(b.sessionId) ||
        typeof b.balanceHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(b.balanceHash) ||
        !cents(b.countedCents) ||
        typeof b.note !== "string" ||
        b.note.length > 500
  )
    throw new Error("Invalid cash operation");
  return p;
}
export function assertCashAction(s: CashSession, p: CashAttempt, actorId: string) {
  if (
    !s ||
    !id(s.id) ||
    s.cashierId !== actorId ||
    s.currency !== "MAD" ||
    !Number.isSafeInteger(s.expectedCents) ||
    s.expectedCents !== s.openingCents + s.cashCents + (s.adjustmentCents ?? 0)
  )
    throw new Error("Unconfirmed cash operation");
  if (p.kind === "open") {
    if (s.openingCents !== p.body.openingCents) throw new Error("Unconfirmed opening");
  } else if (
    s.id !== p.body.sessionId ||
    s.balanceHash !== p.body.balanceHash ||
    !s.closing ||
    s.closing.countedCents !== p.body.countedCents ||
    s.closing.note !== p.body.note ||
    s.closing.differenceCents !== s.closing.countedCents - s.expectedCents
  )
    throw new Error("Unconfirmed closing");
}
