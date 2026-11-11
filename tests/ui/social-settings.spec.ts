import { expect, test, type Page } from "@playwright/test";
import { defaultStoreContacts } from "@imad-store/shared";

async function fixture(page: Page) {
    let settings = {
        id: "settings",
        ...defaultStoreContacts,
        shippingCost: 30,
        freeShippingMin: 500,
        codEnabled: true,
        metaPixelEnabled: false,
    };
    const writes: Record<string, unknown>[] = [];
    let fail = true;
    await page.addInitScript(() => {
        localStorage.setItem("adminToken", "isolated-social-settings");
        localStorage.setItem("imad-admin-language", "fr");
    });
    await page.route("**/api/**", async (route) => {
        const req = route.request(),
            path = new URL(req.url()).pathname;
        if (path === "/api/settings") {
            if (req.method() === "PUT") {
                writes.push(req.postDataJSON());
                if (fail) {
                    fail = false;
                    return route.fulfill({ status: 503, json: { success: false } });
                }
                settings = { ...settings, ...req.postDataJSON() };
            }
            return route.fulfill({ json: { success: true, data: settings } });
        }
        if (req.method() !== "GET") return route.fulfill({ status: 405 });
        if (["/api/categories", "/api/products", "/api/content"].includes(path))
            return route.fallback();
        return route.fulfill({ json: { success: true, data: [], unread: 0, total: 0 } });
    });
    return { writes };
}
for (const width of [390, 1440]) {
    test(`Contact links save safely and reach all storefront buttons at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const { writes } = await fixture(page);
        await page.goto("/admin?tab=commerce");
        const section = page.locator("#social-settings");
        const whatsapp = section.getByLabel("WhatsApp — numéro international ou lien", {
            exact: true,
        });
        await expect(whatsapp).toHaveValue(defaultStoreContacts.whatsappUrl);
        await section
            .getByLabel("Lien Instagram", { exact: true })
            .fill("https://instagram.com.evil.invalid/fixture");
        await section.getByRole("button", { name: "Enregistrer les liens", exact: true }).click();
        await expect(section.getByRole("alert")).toContainText("Utilisez un lien HTTPS");
        expect(writes).toEqual([]);
        await expect(section.getByLabel("Lien Instagram", { exact: true })).toBeFocused();
        await section
            .getByLabel("Lien Instagram", { exact: true })
            .fill("https://www.instagram.com/fixture-store/");
        await section
            .getByLabel("Lien Facebook", { exact: true })
            .fill("https://www.facebook.com/fixture-store/");
        await section.getByLabel("Lien TikTok", { exact: true }).fill("");
        await whatsapp.fill("+212 600 000 099");
        await section.getByRole("button", { name: "Enregistrer les liens", exact: true }).click();
        await expect(section.getByRole("alert")).toContainText("Votre saisie est conservée");
        await expect(whatsapp).toHaveValue("+212 600 000 099");
        let warned = false;
        page.once("dialog", async (dialog) => {
            warned = dialog.type() === "beforeunload";
            await dialog.dismiss();
        });
        await page.reload({ timeout: 2000 }).catch(() => {});
        expect(warned).toBe(true);
        await section.getByRole("button", { name: "Enregistrer les liens", exact: true }).click();
        await expect(
            section.getByText("Liens enregistrés. Ils sont maintenant utilisés sur la boutique.", {
                exact: true,
            }),
        ).toBeVisible();
        await expect(whatsapp).toHaveValue("https://wa.me/212600000099");
        expect(writes).toHaveLength(2);
        expect(Object.keys(writes[1]).sort()).toEqual([
            "facebookUrl",
            "instagramUrl",
            "tiktokUrl",
            "whatsappUrl",
        ]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath("social-settings.png") });
        await page.reload();
        await expect(whatsapp).toHaveValue("https://wa.me/212600000099");
        await page.getByLabel("Langue de l’administration").selectOption("ar");
        await expect(
            section.getByRole("heading", { name: "وسائل التواصل الاجتماعي وواتساب" }),
        ).toBeVisible();
        await expect(section.getByLabel("رابط إنستغرام", { exact: true })).toHaveValue(
            "https://www.instagram.com/fixture-store/",
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath("social-settings-ar.png") });
        await page.goto("/");
        const footer = page.locator(".footer-socials");
        await expect(footer.locator("a")).toHaveCount(3);
        await expect(footer.locator('[data-network="instagram"]')).toHaveAttribute(
            "href",
            "https://www.instagram.com/fixture-store/",
        );
        await expect(footer.locator('[data-network="facebook"]')).toHaveAttribute(
            "href",
            "https://www.facebook.com/fixture-store/",
        );
        await expect(page.locator(".store-whatsapp-float")).toHaveAttribute(
            "href",
            "https://wa.me/212600000099",
        );
        await expect(page.locator(".footer-contact-button")).toHaveAttribute(
            "href",
            "https://wa.me/212600000099",
        );
        await page.goto("/contact");
        await expect(page.locator(".contact-whatsapp")).toHaveAttribute(
            "href",
            "https://wa.me/212600000099",
        );
        await page.goto("/admin?tab=commerce");
        await section.getByLabel("واتساب — رقم دولي أو رابط", { exact: true }).fill("");
        await section.getByRole("button", { name: "حفظ الروابط", exact: true }).click();
        await expect(section.getByText("تم حفظ الروابط واستخدامها في المتجر.")).toBeVisible();
        await page.goto("/");
        await expect(footer.locator("a")).toHaveCount(2);
        await expect(page.locator(".store-whatsapp-float, .footer-contact-button")).toHaveCount(0);
        await page.goto("/contact");
        await expect(page.locator(".contact-whatsapp")).toHaveCount(0);
        await expect(footer.locator("a")).toHaveCount(2);
    });
}

test("Store waits for contact settings instead of exposing old or unsafe links", async ({
    page,
}) => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route("**/api/settings", async (route) => {
        await wait;
        await route.fulfill({
            json: {
                success: true,
                data: {
                    ...defaultStoreContacts,
                    whatsappUrl: "",
                    instagramUrl: "javascript:alert(1)",
                },
            },
        });
    });
    await page.goto("/contact");
    await expect(page.locator(".footer-socials a, .contact-whatsapp")).toHaveCount(0);
    release();
    await expect(page.locator(".footer-socials a")).toHaveCount(2);
    await expect(page.locator(".contact-whatsapp")).toHaveCount(0);
});
