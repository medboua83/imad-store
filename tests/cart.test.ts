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
Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, location: { pathname: "/admin" } },
});

test("Cart quantity promotions combine colours, survive hydration and refresh when the offer changes", async () => {
    const { useCartStore } = await import("../apps/web/src/store/cart.store");
    const { default: api } = await import("../apps/web/src/lib/api");
    const store = () => useCartStore.getState();
    store().clearCart();
    const promoted = {
        ...product,
        quantityDiscounts: [{ minQuantity: 2, unitPrice: 85 }],
        variants: [
            product.variants[0],
            // Persisted references use the same ObjectId format as catalogue variants.
            { ...product.variants[0], id: "123456789012345678901237", sku: "OTHER" },
        ],
    };
    store().addItem(promoted, promoted.variants[0]);
    assert.equal(store().total(), 100);
    store().addItem(promoted, promoted.variants[1]);
    assert.equal(store().total(), 170);
    await useCartStore.persist.rehydrate();
    assert.equal(store().total(), 170);
    store().removeItem(promoted.variants[1].id);
    assert.equal(store().total(), 100);
    store().addItem(promoted, promoted.variants[1]);
    const changed = { ...promoted, quantityDiscounts: [{ minQuantity: 2, unitPrice: 80 }] };
    api.defaults.adapter = async (config) => ({
        data: { data: changed },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
    });
    assert.equal(await store().refreshCart(), true);
    assert.equal(store().total(), 160);
    assert.equal(await store().refreshCart(), false);
    api.defaults.adapter = async (config) => ({
        data: { data: product },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
    });
    assert.equal(await store().refreshCart(), true);
    assert.equal(
        store().total(),
        100,
        "removed variant is unavailable and no longer contributes to thresholds",
    );
    store().clearCart();
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
    useCartStore.setState({
        items: store().items.map(({ images: _images, ...item }) => ({
            ...item,
            image: "/uploads/removed-cover.webp",
        })),
    });
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

for (const unavailable of [false, true]) {
    test(`A late cart response cannot undo a newer ${unavailable ? "unavailable variant" : "price and stock"} snapshot`, async () => {
        const { useCartStore } = await import("../apps/web/src/store/cart.store");
        const { default: api } = await import("../apps/web/src/lib/api");
        const previous = api.defaults.adapter;
        const store = () => useCartStore.getState();
        store().clearCart();
        store().addItem(product, product.variants[0]);
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let calls = 0;
        api.defaults.adapter = async (config) => {
            const first = ++calls === 1;
            if (first) await gate;
            return {
                data: {
                    data: first
                        ? product
                        : {
                              ...product,
                              price: 140,
                              variants: unavailable ? [] : [{ ...product.variants[0], stock: 2 }],
                          },
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config,
            };
        };
        try {
            const old = store().refreshCart();
            while (!calls) await new Promise((resolve) => setTimeout(resolve, 0));
            await store().refreshCart();
            assert.equal(store().items[0].stock, unavailable ? 0 : 2);
            release();
            await old;
            assert.equal(store().items[0].stock, unavailable ? 0 : 2);
            assert.equal(store().items[0].price, 140);
        } finally {
            release();
            api.defaults.adapter = previous;
            store().clearCart();
        }
    });
}

test("Removing and readding a variant cannot inherit an old pending cart snapshot", async () => {
    const { useCartStore } = await import("../apps/web/src/store/cart.store");
    const { default: api } = await import("../apps/web/src/lib/api");
    const previous = api.defaults.adapter;
    const store = () => useCartStore.getState();
    store().clearCart();
    store().addItem(product, product.variants[0]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    let started = false;
    api.defaults.adapter = async (config) => {
        started = true;
        await gate;
        return { data: { data: product }, status: 200, statusText: "OK", headers: {}, config };
    };
    try {
        const old = store().refreshCart();
        while (!started) await new Promise((resolve) => setTimeout(resolve, 0));
        store().removeItem(product.variants[0].id);
        const fresh = { ...product, price: 160, variants: [{ ...product.variants[0], stock: 5 }] };
        store().addItem(fresh, fresh.variants[0], 2);
        release();
        await old;
        assert.equal(store().items[0].price, 160);
        assert.equal(store().items[0].stock, 5);
        assert.equal(store().items[0].quantity, 2);
    } finally {
        release();
        api.defaults.adapter = previous;
        store().clearCart();
    }
});

test("A pending cart refresh keeps quantity edits and removed lines", async () => {
    const { useCartStore } = await import("../apps/web/src/store/cart.store");
    const { default: api } = await import("../apps/web/src/lib/api");
    const previous = api.defaults.adapter,
        store = () => useCartStore.getState();
    store().clearCart();
    store().addItem(product, product.variants[0]);
    const extra = { ...product.variants[0], id: "123456789012345678901239" };
    store().addItem({ ...product, variants: [extra] }, extra);
    let release!: () => void,
        started = false;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    api.defaults.adapter = async (config) => {
        started = true;
        await gate;
        return {
            data: { data: { ...product, price: 130 } },
            status: 200,
            statusText: "OK",
            headers: {},
            config,
        };
    };
    try {
        const pending = store().refreshCart();
        while (!started) await new Promise((resolve) => setTimeout(resolve, 0));
        store().updateQty(product.variants[0].id, 2);
        store().removeItem(extra.id);
        release();
        await pending;
        assert.equal(store().items.length, 1);
        assert.equal(store().items[0].quantity, 2);
        assert.equal(store().total(), 260);
    } finally {
        release();
        api.defaults.adapter = previous;
        store().clearCart();
    }
});

test("A newer failed lookup does not discard an older successful cart lookup", async () => {
    const { useCartStore } = await import("../apps/web/src/store/cart.store");
    const { default: api } = await import("../apps/web/src/lib/api");
    const previous = api.defaults.adapter,
        store = () => useCartStore.getState();
    store().clearCart();
    store().addItem(product, product.variants[0]);
    let release!: () => void,
        calls = 0;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    api.defaults.adapter = async (config) => {
        if (++calls > 1) throw new Error("Newer lookup offline");
        await gate;
        return {
            data: { data: { ...product, price: 150 } },
            status: 200,
            statusText: "OK",
            headers: {},
            config,
        };
    };
    try {
        const older = store().refreshCart();
        while (!calls) await new Promise((resolve) => setTimeout(resolve, 0));
        await assert.rejects(store().refreshCart(), /Newer lookup offline/);
        release();
        await older;
        assert.equal(store().total(), 150);
    } finally {
        release();
        api.defaults.adapter = previous;
        store().clearCart();
    }
});
