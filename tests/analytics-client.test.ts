import { test } from "node:test";
import assert from "node:assert/strict";
import {
    analyticsAllowed,
    analyticsVisit,
    analyticsOrderHeaders,
} from "../apps/web/src/lib/store-analytics";
test("Tracking is ephemeral, respects exclusions, and checkout never invents a visit", () => {
    const original = new Map<string, PropertyDescriptor | undefined>();
    const local = new Map(),
        session = new Map();
    const storage = (map: Map<string, string>) => ({
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => map.set(key, value),
    });
    const browser = { hostname: "shop.example", search: "" },
        navigator = { doNotTrack: "0", globalPrivacyControl: false };
    for (const [key, value] of Object.entries({
        window: {},
        location: browser,
        navigator,
        localStorage: storage(local),
        sessionStorage: storage(session),
    })) {
        original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    }
    try {
        assert.deepEqual(analyticsOrderHeaders(), {});
        const first = analyticsVisit(true)!;
        assert.equal(analyticsVisit(true)!.id, first.id);
        assert.equal(analyticsOrderHeaders()["X-Analytics-Session"], first.id);
        const stored = JSON.parse(session.get("imad:analytics:visit:v1"));
        stored.started = Date.now() - 31 * 60_000;
        session.set("imad:analytics:visit:v1", JSON.stringify(stored));
        assert.deepEqual(analyticsOrderHeaders(), {});
        assert.notEqual(analyticsVisit(true)!.id, first.id);
        local.set("adminToken", "local-test");
        assert.equal(analyticsAllowed(), false);
        local.clear();
        local.set("imad:analytics:exclude", "1");
        assert.equal(analyticsAllowed(), false);
        local.clear();
        navigator.doNotTrack = "1";
        assert.equal(analyticsAllowed(), false);
        navigator.doNotTrack = "0";
        navigator.globalPrivacyControl = true;
        assert.equal(analyticsAllowed(), false);
        navigator.globalPrivacyControl = false;
        browser.hostname = "localhost";
        assert.equal(analyticsAllowed(), false);
        browser.search = "?stats_test=1";
        session.clear();
        assert.equal(analyticsVisit(true)?.test, true);
        assert.equal(analyticsOrderHeaders()["X-Analytics-Test"], "1");
    } finally {
        for (const [key, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});
