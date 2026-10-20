import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutAssistance, assertAssistanceReceipt } from "../apps/web/src/lib/checkout-assistance";
import { ORDER_WHATSAPP_NOTICE_VERSION } from "@imad-store/shared";
test("checked assistance is frozen before async checkout refresh", () => {
    const fields = new FormData(); fields.set("aiServiceConsent", "true");
    const snapshot = checkoutAssistance(fields);
    fields.delete("aiServiceConsent");
    assert.deepEqual(snapshot, { aiServiceConsent: true, aiServiceConsentVersion: ORDER_WHATSAPP_NOTICE_VERSION });
    assert.deepEqual(checkoutAssistance(fields), { aiServiceConsent: false });
});
test("missing or unexpected form values never invent WhatsApp agreement", () => {
    for (const value of [null, "false", "on", "1", "TRUE"]) {
        const fields = new FormData(); if (value !== null) fields.set("aiServiceConsent", value);
        assert.deepEqual(checkoutAssistance(fields), { aiServiceConsent: false });
    }
});
test("a requested agreement must be acknowledged with its exact notice version", () => {
    const requested = { aiServiceConsent: true, aiServiceConsentVersion: ORDER_WHATSAPP_NOTICE_VERSION };
    assert.doesNotThrow(() => assertAssistanceReceipt(requested, requested));
    for (const recorded of [{}, { aiServiceConsent: false }, { aiServiceConsent: true },
        { aiServiceConsent: true, aiServiceConsentVersion: "old-notice" }])
        assert.throws(() => assertAssistanceReceipt(requested, recorded));
    assert.doesNotThrow(() => assertAssistanceReceipt({ aiServiceConsent: false }, {}));
});
