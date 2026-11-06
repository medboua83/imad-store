import test from "node:test";
import assert from "node:assert/strict";
import { catalogReturnPath, productDetailsHref } from "../apps/web/src/lib/catalog-return";

test("Catalogue return keeps the full public search and pagination, without diagnostic or private parameters", () => {
    const value = catalogReturnPath("/shop?search=صابو&category=mens-clogs&sort=price-asc&minPrice=100&maxPrice=500&availability=in-stock&size=40&page=2&filters=open&token=private&stats_test=1#other");
    const target = new URL(value!, "https://store.example");
    assert.equal(target.pathname, "/shop");
    assert.equal(target.hash, "#catalog-results");
    assert.deepEqual(Object.fromEntries(target.searchParams), {
        search: "صابو", category: "mens-clogs", sort: "price-asc", minPrice: "100",
        maxPrice: "500", availability: "in-stock", size: "40", page: "2",
    });
});

test("Catalogue return rejects external URLs, other application pages, ambiguous inputs and control characters", () => {
    for (const target of [undefined, null, ["/shop"], "https://evil.example/shop", "//evil.example/shop",
        "javascript:alert(1)", "/admin", "/shop/../admin", "/shopper", "/shop\\evil", "/shop?x=\nvalue", "/shop?x=" + "a".repeat(2000)])
        assert.equal(catalogReturnPath(target), undefined);
    assert.equal(catalogReturnPath("/shop?size=40&size=44&category=mens-clogs"), "/shop?category=mens-clogs#catalog-results");
});

test("Product links retain a size and a safe return path, while direct links stay unchanged", () => {
    assert.equal(productDetailsHref("fixture-sabot"), "/products/fixture-sabot");
    assert.equal(productDetailsHref("fixture-sabot", "40"), "/products/fixture-sabot?size=40");
    const url = new URL(productDetailsHref("fixture-sabot", "40", "/shop?category=mens-clogs&page=2"), "https://store.example");
    assert.equal(url.searchParams.get("size"), "40");
    assert.equal(url.searchParams.get("returnTo"), "/shop?category=mens-clogs&page=2#catalog-results");
    assert.equal(productDetailsHref("fixture-sabot", undefined, "https://evil.example"), "/products/fixture-sabot");
});
