import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "../apps/web/src/lib/api";
import { AxiosError } from "axios";
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
    },
});
const product: Product = {
    id: "123456789012345678901234",
    slug: "cart-check",
    nameFr: "Sac",
    nameAr: "حقيبة",
    nameEn: "Bag",
    descriptionFr: "",
    descriptionAr: "",
    descriptionEn: "",
    price: 100,
    images: ["/images/hero-1.png"],
    status: "ACTIVE",
    category: {
        id: "123456789012345678901235",
        slug: "bags",
        nameFr: "Sacs",
        nameAr: "حقائب",
        nameEn: "Bags",
    },
    variants: [
        {
            id: "123456789012345678901236",
            color: "#000",
            colorNameFr: "Noir",
            colorNameAr: "أسود",
            colorNameEn: "Black",
            stock: 3,
            sku: "CART-TEST",
        },
    ],
};
test("Cart caps repeated additions and edits, refreshes stale prices/stock and preserves state on outages", async () => {
    const { useCartStore } = await import("../apps/web/src/store/cart.store");
    const { default: api } = await import("../apps/web/src/lib/api");
    const store = () => useCartStore.getState();
    store().clearCart();
    store().addItem(product, product.variants[0], 2);
    store().addItem(product, product.variants[0], 20);
    assert.equal(store().items[0].quantity, 3);
    store().updateQty(product.variants[0].id, 500);
    assert.equal(store().items[0].quantity, 3);
    store().updateQty(product.variants[0].id, NaN);
    assert.equal(store().items[0].quantity, 3);
    const changed = { ...product, price: 120, variants: [{ ...product.variants[0], stock: 1 }] };
    api.defaults.adapter = async (config) => ({
        data: { data: changed },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
    });
    assert.equal(await store().refreshCart(), true);
    assert.equal(store().total(), 120);
    assert.equal(store().items[0].quantity, 1);
    assert.equal(store().items[0].stock, 1);
    assert.equal(await store().refreshCart(), false);
    // Old persisted carts only stored a single cover; recover the full current gallery.
    useCartStore.setState({ items: store().items.map(({ images: _images, ...item }) => ({
        ...item, image: "/uploads/removed-cover.webp",
    })) });
    changed.images = ["/uploads/current-cover.webp", "/uploads/available-alternative.webp"];
    assert.equal(await store().refreshCart(), false, "photo updates do not change order totals");
    assert.deepEqual(store().items[0].images, changed.images);
    assert.equal(store().items[0].image, changed.images[0]);
    api.defaults.adapter = async () => {
        throw new Error("Offline");
    };
    await assert.rejects(store().refreshCart(), /Offline/);
    assert.equal(store().total(), 120);
    api.defaults.adapter = async (config) => {
        throw new AxiosError("Missing", "404", config, undefined, {
            status: 404,
            statusText: "Not Found",
            data: {},
            headers: {},
            config,
        });
    };
    assert.equal(await store().refreshCart(), true);
    assert.equal(store().items[0].quantity, 0);
    assert.equal(store().items[0].stock, 0);
    store().clearCart();
    assert.equal(store().items.length, 0);
});
