import { test } from "node:test";
import assert from "node:assert/strict";
import {
    configurePixel,
    choosePixelConsent,
    metaPage,
    metaPurchase,
} from "../apps/web/src/lib/meta-pixel";
test("Pixel stays unloaded until consent; excludes tests/admin; deduplicates confirmed orders", () => {
    const storage = new Map<string, string>(),
        calls: unknown[][] = [],
        scripts: unknown[] = [];
    const location = {
        protocol: "https:",
        hostname: "shop.example.invalid",
        pathname: "/",
        search: "",
    };
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { doNotTrack: "0" },
    });
    const store = {
        getItem: (k: string) => storage.get(k) || null,
        setItem: (k: string, v: string) => storage.set(k, v),
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: store });
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
            createElement: () => ({}),
            head: { appendChild: (s: unknown) => scripts.push(s) },
        },
    });
    configurePixel(true, "123456789");
    metaPage("/");
    assert.equal(scripts.length, 0);
    choosePixelConsent(false);
    metaPage("/");
    assert.equal(scripts.length, 0);
    choosePixelConsent(true);
    location.search = "?stats_test=1";
    metaPage("/");
    assert.equal(scripts.length, 0);
    location.search = "";
    location.pathname = "/admin";
    metaPage("/");
    assert.equal(scripts.length, 0);
    location.pathname = "/";
    metaPage("/");
    assert.equal(scripts.length, 1);
    const pixel = window.fbq!;
    calls.push(...pixel.queue);
    pixel.callMethod = (...args) => {
        calls.push(args);
    };
    metaPage("/");
    metaPage("/products/test-shoe");
    metaPage("/checkout");
    metaPurchase("order-one", 130);
    metaPurchase("order-one", 130);
    assert.equal(calls.filter((c) => c[2] === "Purchase").length, 1);
    assert.equal(calls.filter((c) => c[2] === "PageView").length, 3);
    assert.equal(calls.filter((c) => c[2] === "ViewContent").length, 1);
    choosePixelConsent(false);
    metaPurchase("order-two", 130);
    assert.equal(calls.filter((c) => c[2] === "Purchase").length, 1);
    configurePixel(false, "123456789");
    choosePixelConsent(true);
    metaPage("/shop");
    assert.equal(scripts.length, 1);
    configurePixel(true, "123456789");
    pixel.callMethod = () => {
        throw new Error("Blocked advertising SDK");
    };
    assert.doesNotThrow(() => metaPage("/shop"));
});
