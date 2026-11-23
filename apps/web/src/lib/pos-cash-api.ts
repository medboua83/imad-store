import api from "./api";
export type CashSession = {
  id: string;
  reference: string;
  currency: "MAD";
  cashierId: string;
  cashierName: string;
  openingCents: number;
  openedAt: string;
  cashCents: number;
  cardCents: number;
  cashCount: number;
  cardCount: number;
  expectedCents: number;
  balanceHash: string;
  closing: null | {
    id: string;
    countedCents: number;
    differenceCents: number;
    note: string;
    closedAt: string;
  };
};
export type CashState = { enabled: boolean; active: CashSession | null };
export type CashOpenBody = { openingCents: number };
export type CashCloseBody = {
  sessionId: string;
  balanceHash: string;
  countedCents: number;
  note: string;
};
export const getCashState = async (signal?: AbortSignal) =>
  (await api.get<{ data: CashState }>("/pos/cash-sessions/context", { signal })).data.data;
export const getCashSession = async (id: string, signal?: AbortSignal) =>
  (await api.get<{ data: CashSession }>("/pos/cash-sessions/" + id, { signal })).data.data;
export const listCashSessions = async (page: number, signal?: AbortSignal) =>
  (
    await api.get<{
      data: CashSession[];
      page: number;
      totalPages: number;
      total: number;
      scope: "ALL" | "OWN";
    }>("/pos/cash-sessions", { params: { page }, signal })
  ).data;
export const sendCashAction = async (
  kind: "open" | "close",
  key: string,
  body: CashOpenBody | CashCloseBody,
) => {
  const r = (
    await api.post<{ success: boolean; data: CashSession }>("/pos/cash-sessions/" + kind, body, {
      headers: { "Idempotency-Key": key },
      timeout: 30000,
    })
  ).data;
  if (r.success !== true) throw new Error("Unconfirmed cash operation");
  return r.data;
};
export const recoverCashAction = async (key: string) =>
  (
    await api.get<{ kind: "open" | "close"; data: CashSession }>(
      "/pos/cash-sessions/attempt/" + encodeURIComponent(key),
    )
  ).data;
