import { test, expect, type Page } from "@playwright/test";
const product = {
    id: "111111111111111111111111",
    slug: "test-product",
    status: "ACTIVE",
    categoryId: "333333333333333333333333",
    nameFr: "Produit fictif",
    nameAr: "منتج تجريبي",
    nameEn: "Test product",
    price: 100,
    images: [],
    variants: [
        {
            id: "222222222222222222222222",
            sku: "TEST-UI",
            stock: 10,
            color: "#000000",
            colorNameFr: "Noir",
            colorNameAr: "أسود",
            colorNameEn: "Black",
            size: "42",
        },
    ],
};
const cart = {
    productId: product.id,
    productSlug: product.slug,
    variantId: product.variants[0].id,
    nameFr: product.nameFr,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    image: "",
    images: [],
    colorNameFr: "Noir",
    colorNameAr: "أسود",
    colorNameEn: "Black",
    size: "42",
    price: 100,
    quantity: 1,
    stock: 10,
};
async function fixture(page: Page, direct = true, failOnce = false) {
    const settings = {
        id: "settings",
        directSiteConfirmation: direct,
        shippingCost: 30,
        freeShippingMin: 500,
        codEnabled: true,
        whatsappAssistanceAvailable: true,
    };
    const requests: { key: string | undefined; body: any }[] = [];
    await page.addInitScript((item) => {
        localStorage.setItem(
            "imad-store-cart",
            JSON.stringify({ state: { items: [item] }, version: 0 }),
        );
        localStorage.setItem("adminToken", "isolated-ui-fixture");
    }, cart);
    await page.route("**/api/**", async (route) => {
        const req = route.request(),
            path = new URL(req.url()).pathname;
        let result: any = { success: true, data: [], total: 0, unread: 0 };
        if (path === "/api/settings") {
            if (req.method() === "PUT") Object.assign(settings, req.postDataJSON());
            result = { success: true, data: settings };
        } else if (path === "/api/products/test-product") result.data = product;
        else if (path === "/api/orders" && req.method() === "POST") {
            const body = req.postDataJSON();
            requests.push({ key: req.headers()["idempotency-key"], body });
            if (failOnce && requests.length === 1) return route.abort("failed");
            await new Promise((resolve) => setTimeout(resolve, 150));
            result.data = {
                id: "444444444444444444444444",
                totalAmount: 130,
                status: direct ? "CONFIRMED" : "PENDING",
                confirmationMethod: direct ? "SITE" : null,
                confirmedAt: direct ? "2026-10-22T08:00:00.000Z" : null,
                aiServiceConsent: body.aiServiceConsent,
                aiServiceConsentVersion: body.aiServiceConsentVersion,
            };
        }
        await route.fulfill({ json: result });
    });
    return { settings, requests };
}
async function fillCheckout(page: Page, phone = "0600000099") {
    await page.goto("/checkout");
    await page.getByLabel("الاسم الكامل").fill("Client fictif");
    await page.getByLabel("رقم الهاتف", { exact: false }).fill(phone);
    await page.getByLabel("المدينة", { exact: false }).selectOption("rabat");
    await page.getByLabel("عنوان التوصيل", { exact: false }).fill("Adresse fictive 1");
}
test("A saved cart hydrates without React text mismatches and survives reload", async ({page}) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if(message.type() === "error" && /hydration|#418|server rendered/i.test(message.text())) errors.push(message.text()); });
    await fixture(page);
    await page.goto("/checkout");
    await expect(page.getByRole("button", {name:"فتح السلة، 1 قطعة",exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", {name:"فتح السلة، 1 قطعة",exact:true})).toBeVisible();
    await page.getByRole("button", {name:"فتح السلة، 1 قطعة",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("130.00");
    expect(errors).toEqual([]);
});
for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
]) {
    test(`direct checkout review/edit/one commit at ${viewport.width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize(viewport);
        const { requests } = await fixture(page);
        await fillCheckout(page);
        await expect(page.getByRole("checkbox", { name: /واتساب/ })).toHaveCount(0);
        await page.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
        const review = page.getByRole("region", { name: "راجعوا طلبكم قبل التأكيد النهائي" });
        await expect(review).toBeVisible();
        await expect(review).toContainText("Client fictif");
        await expect(review).toContainText("130.00");
        expect(requests).toHaveLength(0);
        await page.getByRole("button", { name: "تعديل المعلومات", exact: true }).click();
        await page.getByLabel("المدينة", { exact: false }).selectOption("tangier");
        await expect(review).toHaveCount(0);
        await page.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
        await expect(review).toContainText("طنجة");
        expect(requests).toHaveLength(0);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.screenshot({
            path: info.outputPath(`review-${viewport.width}.png`),
            fullPage: true,
        });
        await page
            .getByRole("button", { name: "أؤكد طلبي", exact: true })
            .evaluate((button: HTMLButtonElement) => {
                button.click();
                button.click();
            });
        await expect(
            page.getByText("تم تأكيد طلبكم مباشرة على الموقع. لا يلزم تأكيد إضافي عبر واتساب."),
        ).toBeVisible();
        expect(requests).toHaveLength(1);
        expect(requests[0].body).toMatchObject({
            confirmationMode: "SITE",
            aiServiceConsent: false,
            expectedTotal: 130,
            customer: { city: "tangier", street: "Adresse fictive 1", phone: "0600000099" },
        });
    });
}
test("standard checkout has no customer AI option", async ({ page }) => {
    const { requests } = await fixture(page, false);
    await fillCheckout(page, "+212600000099");
    await expect(page.locator('input[name="aiServiceConsent"]')).toHaveCount(0);
    await page.getByRole("button", { name: "تأكيد الطلب", exact: true }).click();
    await expect(page.getByText("سيتواصل معكم فريقنا لتأكيد التفاصيل.")).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].body.confirmationMode).toBeUndefined();
    expect(requests[0].body.aiServiceConsent).toBe(false);
});
test("delivery fields use official cities and preserve local delivery phone", async ({ page }, info) => {
    const { requests } = await fixture(page, false);
    await fillCheckout(page, "0600000099");
    const city = page.getByRole("combobox", { name: /المدينة/ });
    await expect(city.locator("option")).toHaveCount(356);
    await city.selectOption("tangier");
    await expect(city).toHaveValue("tangier");
    await expect(page.getByLabel("عنوان التوصيل", { exact: false })).toHaveAttribute("maxlength", "124");
    await expect(page.getByLabel("الاسم الكامل")).toHaveAttribute("minlength", "3");
    await page.screenshot({ path: info.outputPath("carrier-compatible-checkout.png"), fullPage: true });
    await page.getByRole("button", { name: "تأكيد الطلب", exact: true }).click();
    await expect(page.getByText("سيتواصل معكم فريقنا لتأكيد التفاصيل.")).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].body.customer).toMatchObject({ city: "tangier", phone: "0600000099", street: "Adresse fictive 1" });
    expect(requests[0].body.aiServiceConsent).toBe(false);
});
test("network retry retains the same idempotency key and request", async ({ page }) => {
    const { requests } = await fixture(page, true, true);
    await fillCheckout(page);
    await page.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
    await page.getByRole("button", { name: "أؤكد طلبي", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "أؤكد طلبي", exact: true }).click();
    await expect(
        page.getByText("تم تأكيد طلبكم مباشرة على الموقع. لا يلزم تأكيد إضافي عبر واتساب."),
    ).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[0].key).toBeTruthy();
    expect(requests[0]).toEqual(requests[1]);
});
test("dashboard switch saves ON and OFF and reloads the saved value", async ({ page }) => {
    const { settings } = await fixture(page, false);
    await page.goto("/admin");
    await page.getByRole("button", { name: "Paramètres", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "Confirmation directe sur le site" });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Gestion des commandes enregistrée.")).toBeVisible();
    expect(settings.directSiteConfirmation).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Paramètres", exact: true }).click();
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Gestion des commandes enregistrée.")).toBeVisible();
    expect(settings.directSiteConfirmation).toBe(false);
});
