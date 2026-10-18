import type { AdminOrder } from "@/lib/api";
export const paymentLabels: Record<string, string> = {
    PENDING: "En attente de paiement",
    PAID: "Payé",
    FAILED: "Paiement échoué",
    REFUNDED: "Remboursé",
};
export const orderDate = (value: string) =>
    new Date(value).toLocaleString("fr-MA", {
        timeZone: "Africa/Casablanca",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
export function orderDay(value: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Casablanca",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
}
export function refineOrders(
    orders: AdminOrder[],
    payment: string,
    from: string,
    to: string,
    sort: string,
) {
    return orders
        .filter(
            (o) =>
                (payment === "ALL" || o.paymentStatus === payment) &&
                (!from || orderDay(o.createdAt) >= from) &&
                (!to || orderDay(o.createdAt) <= to),
        )
        .slice()
        .sort((a, b) =>
            sort === "oldest"
                ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
                : sort === "amount"
                  ? b.totalAmount - a.totalAmount
                  : Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
}
export function orderAmounts(order: AdminOrder) {
    const items = order.items ?? [];
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const shipping = order.shippingCost;
    return {
        subtotal,
        shipping,
        reconciled:
            items.length > 0 &&
            shipping !== undefined &&
            Math.abs(subtotal + shipping - order.totalAmount) < 0.01,
    };
}
