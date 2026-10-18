export const statusLabels: Record<string, string> = {
    PENDING: "À confirmer",
    CONFIRMED: "Confirmée",
    SHIPPED: "Expédiée",
    DELIVERED: "Livrée",
    CANCELLED: "Annulée",
};
export const allowedActions: Record<string, readonly string[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
};
export const money = (value: number) =>
    new Intl.NumberFormat("fr-MA", {
        style: "currency",
        currency: "MAD",
        maximumFractionDigits: 2,
    }).format(value);
export function summarize(
    orders: { status: string; totalAmount: number }[],
    products: { status: string; variants: { stock: number }[] }[],
) {
    return {
        pending: orders.filter((o) => o.status === "PENDING").length,
        deliveredAmount: orders
            .filter((o) => o.status === "DELIVERED")
            .reduce((sum, o) => sum + o.totalAmount, 0),
        activeProducts: products.filter((p) => p.status === "ACTIVE").length,
        lowStock: products.filter(
            (p) => p.status === "ACTIVE" && p.variants.some((v) => v.stock <= 3),
        ).length,
    };
}
export function filterOrders<
    T extends {
        id: string;
        customerName: string | null;
        customerPhone: string | null;
        city: string | null;
        status: string;
    },
>(orders: T[], search: string, status: string) {
    const q = search.trim().toLocaleLowerCase();
    const phone = q.replace(/[\s()+.-]/g, "");
    return orders.filter(
        (o) =>
            (status === "ALL" || o.status === status) &&
            (!q ||
                [o.id, o.customerName, o.city].some((v) => v?.toLocaleLowerCase().includes(q)) ||
                (phone.length > 0 &&
                    (o.customerPhone || "").replace(/[\s()+.-]/g, "").includes(phone))),
    );
}
