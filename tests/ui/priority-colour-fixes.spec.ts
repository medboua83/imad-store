import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
    test(`Mobile WhatsApp stays inside the reserved navigation at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/shop");
        const contact = page.locator(".mobile-dock-whatsapp");
        await expect(contact).toBeVisible();
        await expect(contact).toHaveAttribute("href", "https://wa.me/message/M44N6KT35MW4N1");
        await expect(contact).toHaveAttribute("target", "_blank");
        await expect(page.locator(".store-whatsapp-float")).toBeHidden();
        await expect(page.locator(".mobile-dock > a, .mobile-dock > button")).toHaveCount(4);
        const box = (await contact.boundingBox())!;
        const nav = (await page.locator(".mobile-dock").boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y).toBeGreaterThanOrEqual(nav.y);
        expect(box.y + box.height).toBeLessThanOrEqual(nav.y + nav.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

for (const width of [390, 1440]) {
    test(`Gallery navigation selects the mapped colour at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/products/fixture-color-photos");
        await page.getByRole("button", { name: "عرض الصورة 2", exact: true }).click();
        await expect(page.getByRole("button", { name: "بني", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("button", { name: "44", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "45", exact: true }).click();
        await page.getByRole("button", { name: "عرض الصورة 3", exact: true }).click();
        await expect(page.getByRole("button", { name: "أسود", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "الصورة التالية", exact: true }).click();
        await expect(page.locator(".gallery-color-notice")).toBeVisible();
        await expect(page.getByRole("button", { name: "أسود", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "الصورة التالية", exact: true }).click();
        await expect(page.getByRole("button", { name: "بني", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.locator(".bag-line-detail")).toContainText("بني");
        await expect(page.locator(".bag-line-photo img")).toHaveJSProperty("src", new URL("/images/catalogue-test/abaya.webp", page.url()).href);
    });
}

test("A grouped colour filter carries a matching real SKU to the product", async ({ page }) => {
    await page.goto("/shop?search=one-size-fixture&filters=open");
    const color = page.getByRole("combobox", { name: "اللون", exact: true });
    await expect(color.locator("option")).toHaveText(["جميع الألوان", "بني"]);
    await color.selectOption("group:#804000,#804001");
    await page.getByRole("button", { name: "عرض النتائج", exact: true }).click();
    await expect(page).toHaveURL(/color=group/);
    const card = page.locator(".catalog-card");
    await expect(card.locator(".stock-pill")).toHaveText("متوفر الآن");
    await expect(card.locator(".product-option-preview")).toContainText("بني");
    await expect(card.locator(".variant-hint")).not.toContainText("0 خيارات");
    await expect(card.locator(".catalog-card-image img")).toHaveJSProperty("src", new URL("/images/catalogue-test/abaya.webp", page.url()).href);
    await page.locator(".catalog-card-image").click();
    await expect(page.getByRole("button", { name: "بني", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toBeEnabled();
});

test("A failed mapped gallery photo cannot display another colour silently", async ({ page }) => {
    await page.route("**/images/catalogue-test/abaya.webp", route => route.fulfill({ status: 404, body: "" }));
    await page.goto("/products/fixture-color-photos");
    await page.getByRole("button", { name: "بني", exact: true }).click();
    await expect(page.locator(".gallery-stage .gallery-empty")).toBeVisible();
    await expect(page.locator(".gallery-stage img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "بني", exact: true })).toHaveAttribute("aria-pressed", "true");
});
