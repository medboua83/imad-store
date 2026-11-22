export const initialOrderListFilters = {
    page: 1,
    search: "",
    status: "ALL",
    payment: "ALL",
    from: "",
    to: "",
    sort: "newest",
};
export type OrderListFilters = typeof initialOrderListFilters;
