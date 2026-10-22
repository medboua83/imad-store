import { test } from "node:test";
import assert from "node:assert/strict";
import { productShareMetadata, resolvePublicOrigin } from "../apps/web/src/lib/share-metadata";
test("public origin supports hosting without SITE_URL and independent stores", () => {
  assert.equal(resolvePublicOrigin(undefined, "quickydev.com").href, "https://quickydev.com/");
  assert.equal(resolvePublicOrigin(undefined, "store.example").href, "https://store.example/");
  assert.equal(
    resolvePublicOrigin("https://shop.example/path", "internal:3000").href,
    "https://shop.example/",
  );
  assert.equal(resolvePublicOrigin(undefined, "localhost:3000").protocol, "http:");
  assert.throws(() => resolvePublicOrigin("javascript:alert(1)", "shop.example"));
  assert.throws(() => resolvePublicOrigin(undefined, "bad/host"));
});
test("each product supplies its own absolute cover, title, description and both social cards", () => {
  for (const slug of ["existing-product", "future-product"]) {
    const result = productShareMetadata(
      {
        slug,
        nameFr: slug,
        descriptionFr: "<p>Une belle pièce</p>",
        images: ["", "data:image/png,test", `/uploads/${slug}.webp`, "/other.webp"],
      },
      new URL("https://shop.example"),
    );
    const og = result.openGraph as any,
      twitter = result.twitter as any;
    assert.equal(og.title, slug);
    assert.equal(og.description, "Une belle pièce");
    assert.equal(og.images[0].url, `https://shop.example/uploads/${slug}.webp`);
    assert.equal(og.images.length, 1);
    assert.equal(og.url, `https://shop.example/products/${slug}`);
    assert.deepEqual(twitter.images, og.images);
    assert.equal(twitter.title, slug);
    assert.equal(twitter.card, "summary_large_image");
  }
});
test("empty catalogue image does not substitute an unrelated logo; multilingual fallback", () => {
  const result = productShareMetadata(
    { slug: "new", nameAr: "  ", nameEn: "Product", descriptionEn: "Details", images: [] },
    new URL("https://shop.example"),
  );
  assert.equal(result.title, "Product");
  assert.equal(result.description, "Details");
  assert.deepEqual((result.openGraph as any).images, []);
});
