import { test } from "node:test";
import assert from "node:assert/strict";
import {
    categoryImageSources,
    categoryVisual,
} from "../apps/web/src/components/store/category-visuals";
import type { Category, Product } from "../apps/web/src/lib/api";
test("A missing custom category image can fall back to its own published product before an illustration", () => {
    const category = { slug: "mens-clogs", image: "/uploads/missing.webp" } as Category;
    const products = [
        {
            images: ["/uploads/published.webp", "/uploads/published.webp"],
            category: { slug: "mens-clogs" },
        },
        { images: ["/uploads/unrelated.webp"], category: { slug: "bags" } },
    ] as Product[];
    const sources = categoryImageSources(category, products);
    assert.deepEqual(sources.slice(0, 2), ["/uploads/missing.webp", "/uploads/published.webp"]);
    assert.equal(sources.includes("/uploads/unrelated.webp"), false);
    assert.equal(sources.length, 3);
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
