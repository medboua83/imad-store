import api from "./api";
import type { PosLine, PosItem } from "./pos-api";
export type ReturnInput = {
  sourceKind: "SALE" | "EXCHANGE";
  sourceId: string;
  returns: { itemId: string; quantity: number; restock: boolean }[];
  replacements: PosItem[];
};
export type ReturnSource = {
  id: string;
  kind: ReturnInput["sourceKind"];
  reference: string;
  rootSaleId: string;
  items: (PosLine & {
    id: string;
    returnedQuantity: number;
    refundedCents: number;
    remainingQuantity: number;
    canRestock: boolean;
  })[];
};
export type ReturnQuote = {
  currency: "MAD";
  quoteHash: string;
  returnCents: number;
  replacementCents: number;
  netCents: number;
  returns: (PosLine & { sourceItemId: string; restock: boolean })[];
  replacements: PosLine[];
};
export type ReturnBody = ReturnInput & {
  quoteHash: string;
  cashSessionId: string;
  paymentMethod: "CASH" | "CARD_TERMINAL" | "NONE";
  receivedCents: number;
  note: string;
};
export type ReturnReceipt = {
  id: string;
  reference: string;
  currency: "MAD";
  cashierId: string;
  cashierName: string;
  cashSessionId: string;
  rootSaleId: string;
  sourceSaleId: string | null;
  sourceAdjustmentId: string | null;
  returnCents: number;
  replacementCents: number;
  netCents: number;
  paymentMethod: ReturnBody["paymentMethod"];
  receivedCents: number;
  changeCents: number;
  note: string;
  createdAt: string;
  items: (PosLine & {
    id: string;
    kind: "RETURN" | "REPLACEMENT";
    sourceItemId: string | null;
    restock: boolean | null;
  })[];
};
export const returnSource = async (
  kind: ReturnInput["sourceKind"],
  id: string,
  signal?: AbortSignal,
) =>
  (await api.get<{ data: ReturnSource }>("/pos/returns/source", { params: { kind, id }, signal }))
    .data.data;
export const quoteReturn = async (body: ReturnInput) =>
  (await api.post<{ data: ReturnQuote }>("/pos/returns/quote", body)).data.data;
export const completeReturn = async (key: string, body: ReturnBody) => {
  const r = (
    await api.post<{ success: boolean; data: ReturnReceipt }>("/pos/returns", body, {
      headers: { "Idempotency-Key": key },
      timeout: 30000,
    })
  ).data;
  if (r.success !== true) throw new Error("Unconfirmed return");
  return r.data;
};
export const recoverReturn = async (key: string) =>
  (await api.get<{ data: ReturnReceipt }>("/pos/returns/by-key/" + encodeURIComponent(key))).data
    .data;
export const getReturn = async (id: string, signal?: AbortSignal) =>
  (await api.get<{ data: ReturnReceipt }>("/pos/returns/" + id, { signal })).data.data;
export const listReturns = async (page: number, signal?: AbortSignal) =>
  (
    await api.get<{ data: ReturnReceipt[]; total: number; totalPages: number; page: number }>(
      "/pos/returns",
      { params: { page }, signal },
    )
  ).data;
