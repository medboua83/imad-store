import { test } from "node:test";
import assert from "node:assert/strict";
import { translateAdminText } from "../apps/web/app/admin/admin-locale";
import { adminArabic } from "../apps/web/app/admin/admin-translations";

test("French interface and original business values remain intact", () => {
    assert.equal(translateAdminText("Produits", "fr"), "Produits");
    assert.equal(translateAdminText("ORIGINAL-SKU", "ar"), "ORIGINAL-SKU");
    assert.equal(translateAdminText("https://imadmode.com", "ar"), "https://imadmode.com");
    assert.equal(
        translateAdminText("Commande #{reference} : {status}.", "fr", {
            reference: "12345678",
            status: "Confirmée",
        }),
        "Commande #12345678 : Confirmée.",
    );
});

test("Arabic labels, counts, punctuation and plural suffixes are localized", () => {
    assert.equal(translateAdminText("Produits", "ar"), "المنتجات");
    assert.equal(translateAdminText(" Modifier ", "ar"), " تعديل ");
    assert.equal(translateAdminText("s", "ar"), "");
    assert.equal(
        translateAdminText("Notifications, {0} non lues", "ar", { 0: 3 }),
        "الإشعارات، 3 غير مقروءة",
    );
});

test("Translations retain all placeholder values", () => {
    for (const [key, value] of Object.entries(adminArabic)) {
        const tokens = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
        assert.deepEqual(tokens(value), tokens(key), key);
    }
});

test("Dynamic feedback preserves filenames, references and numeric values", () => {
    assert.equal(
        translateAdminText("Envoi 2/4 : photo originale.webp", "ar"),
        "رفع 2/4: photo originale.webp",
    );
    assert.equal(
        translateAdminText("Commande #12345678 : Confirmée.", "ar"),
        "الطلب #12345678: مؤكدة.",
    );
    assert.equal(
        translateAdminText("La ville « Rabat » figure déjà dans une autre ligne.", "ar"),
        "المدينة «Rabat» موجودة في سطر آخر.",
    );
});
