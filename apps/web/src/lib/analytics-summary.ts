import type { StoreAnalyticsSummary } from "./api";

/** Reject incomplete responses before presenting them as a successful statistics refresh. */
export function isAnalyticsSummary(value: unknown, period: number): value is StoreAnalyticsSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const counter = (n: unknown): n is number =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const stamp = (s: unknown): s is string =>
    typeof s === "string" && Number.isFinite(Date.parse(s));
  if (
    v.days !== period ||
    !stamp(v.start) ||
    !stamp(v.end) ||
    Date.parse(v.start) > Date.parse(v.end) ||
    !(v.trackingSince === null || stamp(v.trackingSince)) ||
    ![v.visits, v.convertedVisits, v.pageViews, v.productViews, v.attributedOrders].every(
      counter,
    ) ||
    !(
      v.orderRate === null ||
      (typeof v.orderRate === "number" &&
        Number.isFinite(v.orderRate) &&
        v.orderRate >= 0 &&
        v.orderRate <= 100)
    ) ||
    !Array.isArray(v.products) ||
    !v.products.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        counter(p.views),
    )
  )
    return false;
  if (v.funnel !== undefined) {
    if (!v.funnel || typeof v.funnel !== "object") return false;
    const f = v.funnel as Record<string, unknown>;
    if (
      ![
        f.cartVisits,
        f.checkoutVisits,
        f.confirmedOrders,
        f.shippedOrders,
        f.deliveredOrders,
        f.cancelledOrders,
        f.unknownOrders,
      ].every(counter)
    )
      return false;
  }
  return true;
}
