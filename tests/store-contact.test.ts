import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultStoreContacts, normalizeStoreContact, storeContacts } from "../packages/shared/src/store-contact";

test("Contact defaults preserve existing accounts, explicit blanks hide them and invalid links stay hidden", () => {
    assert.deepEqual(storeContacts(), defaultStoreContacts);
    assert.equal(storeContacts({ facebookUrl: null }).facebookUrl, defaultStoreContacts.facebookUrl);
    assert.equal(storeContacts({ facebookUrl: "" }).facebookUrl, "");
    assert.equal(storeContacts({ facebookUrl: "javascript:alert(1)" }).facebookUrl, "");
});
test("WhatsApp normalizes international numbers and keeps valid business links", () => {
    assert.equal(normalizeStoreContact("whatsappUrl", "+212 (600) 000-099"), "https://wa.me/212600000099");
    assert.equal(normalizeStoreContact("whatsappUrl", "00212600000099"), "https://wa.me/212600000099");
    assert.equal(normalizeStoreContact("whatsappUrl", defaultStoreContacts.whatsappUrl), defaultStoreContacts.whatsappUrl);
    assert.equal(normalizeStoreContact("whatsappUrl", "https://api.whatsapp.com/send?phone=212600000099"), "https://api.whatsapp.com/send?phone=212600000099");
    for (const value of ["0660000099", "+212", "https://wa.me/", "https://wa.me.evil.invalid/212600000099", "https://api.whatsapp.com/send?phone=bad", "http://wa.me/212600000099"]) assert.equal(normalizeStoreContact("whatsappUrl", value), null, value);
});
test("Social links reject active content, foreign domains, credentials and nonstandard ports", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,a", "http://facebook.com/a", "https://facebook.com.evil.invalid/a", "https://evilfacebook.com/a", "https://facebook.com@evil.invalid/a", "https://name@facebook.com/a", "https://facebook.com:8443/a"]) assert.equal(normalizeStoreContact("facebookUrl", value), null, value);
    assert.equal(normalizeStoreContact("facebookUrl", "  https://m.facebook.com/fixture/  "), "https://m.facebook.com/fixture/");
    assert.equal(normalizeStoreContact("instagramUrl", "https://www.facebook.com/fixture/"), null);
    assert.equal(normalizeStoreContact("tiktokUrl", "https://vm.tiktok.com/fixture/"), "https://vm.tiktok.com/fixture/");
});
