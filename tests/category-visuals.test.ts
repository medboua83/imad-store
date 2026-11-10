import { test } from "node:test";
import assert from "node:assert/strict";
import {
    categoryImageSources,
    categoryVisual,
} from "../apps/web/src/components/store/category-visuals";
import type { Category, Product } from "../apps/web/src/lib/api";
test("Unconfigured categories fall back to their own products without borrowing unrelated photos", () => {
    const category = { slug: "other-category", image: "/uploads/missing.webp" } as Category;
    const products = [
        {
            images: ["/uploads/published.webp", "/uploads/published.webp"],
            category: { slug: "other-category" },
        },
        { images: ["/uploads/unrelated.webp"], category: { slug: "bags" } },
    ] as Product[];
    const sources = categoryImageSources(category, products);
    assert.deepEqual(sources.slice(0, 2), ["/uploads/missing.webp", "/uploads/published.webp"]);
    assert.equal(sources.includes("/uploads/unrelated.webp"), false);
    assert.equal(sources.length, 2);
    assert.equal(categoryVisual(category, products).src, sources[0]);
});
test("Legacy placeholder images are ignored and unknown empty categories have a neutral fallback", () => {
    const category = {
        slug: "unknown",
        image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    } as Category;
    assert.deepEqual(categoryImageSources(category, []), []);
    assert.equal(categoryVisual(category, []).src, null);
});

test("The owner-selected Sabots artwork is shared by homepage, menu and shop", () => {
    const category = { slug: "mens-clogs", image: "/uploads/old-cover.webp" } as Category;
    const sources = categoryImageSources(category, []);
    assert.equal(sources[0], "/images/categories/sabots-homme-v2.webp");
    assert.equal(sources[1], category.image);
    assert.equal(categoryVisual(category, []).illustrative, true);
});

test("New category thumbnails reuse published product originals without changing custom artwork", () => {
    const category = {
        slug: "coats",
        image: "/uploads/custom.webp",
        productImages: ["/uploads/coat.webp", "/uploads/coat-detail.webp"],
    } as Category;
    assert.deepEqual(categoryImageSources(category, []), [
        "/uploads/custom.webp",
        "/uploads/coat.webp",
        "/uploads/coat-detail.webp",
    ]);
    assert.equal(categoryVisual({ ...category, image: undefined }, []).src, "/uploads/coat.webp");
});
