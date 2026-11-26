import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStoreAmount, formatStoreMoney } from "../apps/web/src/lib/store-money";
import { isAnalyticsSummary } from "../apps/web/src/lib/analytics-summary";

test("Store money labels use grouped decimal amounts consistently, including zero and refunds", () => {
  const price = 12345.6;
  assert.equal(formatStoreAmount(price).replace(/\s/g, " "), "12 345,60");
  assert.equal(formatStoreMoney(0), "0,00 MAD");
  assert.equal(formatStoreMoney(230), "230,00 MAD");
  assert.equal(formatStoreMoney(-23), "-23,00 MAD");
  for (const bad of [NaN, Infinity, -Infinity]) assert.equal(formatStoreMoney(bad), "—");
});
const valid = () => ({
  days: 7,
  start: "2026-11-19T10:00:00Z",
  end: "2026-11-26T10:00:00Z",
  trackingSince: null,
  visits: 20,
  convertedVisits: 2,
  pageViews: 35,
  productViews: 25,
  attributedOrders: 3,
  orderRate: 10,
  products: [{ id: "fixture", name: "Article fictif", views: 25 }],
  funnel: {
    cartVisits: 4,
    checkoutVisits: 3,
    confirmedOrders: 2,
    shippedOrders: 1,
    deliveredOrders: 0,
    cancelledOrders: 1,
    unknownOrders: 0,
  },
});
test("A statistics refresh must contain complete valid figures from the selected period", () => {
  assert.equal(isAnalyticsSummary(valid(), 7), true);
  for (const change of [
    { days: 30 },
    { visits: -1 },
    { productViews: null },
    { attributedOrders: 1.5 },
    { orderRate: NaN },
    { orderRate: 101 },
    { start: "unknown" },
    { end: "2020-01-01T00:00:00Z" },
    { products: [{ id: "fixture", name: "Article", views: "25" }] },
    { funnel: { cartVisits: 4 } },
  ])
    assert.equal(isAnalyticsSummary({ ...valid(), ...change }, 7), false, JSON.stringify(change));
  assert.equal(isAnalyticsSummary({ days: 7 }, 7), false);
  assert.equal(
    isAnalyticsSummary(
      { ...valid(), visits: 0, convertedVisits: 0, orderRate: null, products: [] },
      7,
    ),
    true,
  );
});
