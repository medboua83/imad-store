export const initialOrderListFilters = {
    search: "",
    status: "ALL",
    payment: "ALL",
    from: "",
    to: "",
    sort: "newest",
};
export type OrderListFilters = typeof initialOrderListFilters;
