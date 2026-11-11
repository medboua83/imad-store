import type { InventoryStatus } from "./product-utils";

export type InventoryListFilters = { stock: InventoryStatus; search: string; page: number };
export const initialInventoryListFilters: InventoryListFilters = { stock: "ALL", search: "", page: 1 };
