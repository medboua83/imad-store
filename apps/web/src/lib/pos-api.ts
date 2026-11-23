import api from "./api";
export type PosItem = { variantId: string; quantity: number };
export type PosVariant = {
  id: string;
  productId: string;
  sku: string;
  nameFr: string;
  nameAr: string;
  size: string | null;
  colorFr: string;
  colorAr: string;
  stock: number;
  available: boolean;
  unitPriceCents: number;
  image: string | null;
};
export type PosLine = PosItem & {
  productId: string;
  sku: string;
  nameFr: string;
  nameAr: string;
  colorFr: string;
  colorAr: string;
  size: string | null;
  unitPriceCents: number;
  totalCents: number;
};
export type PosQuote = {
  currency: "MAD";
  quoteHash: string;
  totalCents: number;
  savingsCents: number;
  lines: PosLine[];
};
export type PosBody = {
  items: PosItem[];
  quoteHash: string;
  paymentMethod: "CASH" | "CARD_TERMINAL";
  receivedCents: number;
  cashSessionId?: string;
};
export type PosReceipt = {
  cashSessionId?: string | null;
  id: string;
  reference: string;
  currency: "MAD";
  cashierId: string;
  cashierName: string;
  paymentMethod: PosBody["paymentMethod"];
  totalCents: number;
  savingsCents: number;
  receivedCents: number;
  changeCents: number;
  createdAt: string;
  items: PosLine[];
};
export type PosHistory = {
  data: Pick<
    PosReceipt,
    "id" | "cashierId" | "cashierName" | "paymentMethod" | "totalCents" | "createdAt"
  >[];
  total: number;
  page: number;
  totalPages: number;
  scope: "ALL" | "OWN";
  cashiers: { id: string; name: string }[];
  today: { count: number; totalCents: number };
};
export const getPosContext = async (signal?: AbortSignal) =>
  (
    await api.get<{
      success: boolean;
      data: { actorId: string; canSell: boolean; canReadAll: boolean; canReturn: boolean };
    }>("/pos/context", { signal })
  ).data.data;
export const getPosCatalog = async (search: string, page: number, signal?: AbortSignal) =>
  (
    await api.get<{ data: PosVariant[]; total: number; page: number; totalPages: number }>(
      "/pos/catalog",
      { params: { search, page }, signal },
    )
  ).data;
export const scanPosVariant = async (sku: string, signal?: AbortSignal) =>
  (await api.get<{ data: PosVariant }>("/pos/scan", { params: { sku }, signal })).data.data;
export const quotePosCart = async (items: PosItem[], signal?: AbortSignal) =>
  (await api.post<{ data: PosQuote }>("/pos/quote", { items }, { signal })).data.data;
export const recordPosSale = async (key: string, body: PosBody) => {
  const r = (
    await api.post<{ success: boolean; data: PosReceipt }>("/pos/sales", body, {
      headers: { "Idempotency-Key": key },
      timeout: 30000,
    })
  ).data;
  if (r.success !== true) throw new Error("Unconfirmed sale");
  return r.data;
};
export const recoverPosSale = async (key: string) =>
  (await api.get<{ data: PosReceipt }>(`/pos/sales/by-key/${encodeURIComponent(key)}`)).data.data;
export const getPosReceipt = async (id: string, signal?: AbortSignal) =>
  (await api.get<{ data: PosReceipt }>(`/pos/sales/${id}`, { signal })).data.data;
export const listPosSales = async (
  search: string,
  cashierId: string,
  page: number,
  signal?: AbortSignal,
  filters: { from?: string; to?: string; paymentMethod?: string } = {},
) =>
  (
    await api.get<PosHistory>("/pos/sales", {
      params: { search, ...(cashierId ? { cashierId } : {}), ...filters, page },
      signal,
    })
  ).data;
