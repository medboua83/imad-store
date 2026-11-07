import { test, expect, type Page } from "@playwright/test";
const item = {
    productId: "222222222222222222222222",
    productSlug: "fixture-sabot",
    variantId: "333333333333333333333330",
    nameFr: "Sabot fictif",
    nameAr: "صابو تجريبي",
    nameEn: "Fixture clog",
    colorNameFr: "أسود",
    colorNameAr: "أسود",
    colorNameEn: "Black",
    size: "40",
    price: 230,
    quantity: 1,
    stock: 2,
    image: "/images/catalogue-test/sac.webp",
    freeShipping: true,
};
async function prepare(page: Page) {
    await page.addInitScript(
        (value) =>
            localStorage.setItem(
                "imad-store-cart",
                JSON.stringify({ state: { items: [value] }, version: 0 }),
            ),
        item,
    );
    const requests: {
        customer: { phone: string; city: string; street: string };
        expectedTotal: number;
    }[] = [];
    await page.route("**/api/orders", (route) => {
        requests.push(route.request().postDataJSON());
        return route.abort("failed");
    });
    await page.goto("/checkout?stats_test=1");
    await expect(page.getByRole("button", { name: "تأكيد الطلب", exact: true })).toBeEnabled();
    return requests;
}
for (const width of [320, 390, 1440]) {
    test(`One city field supports Arabic, French, keyboard selection and clearing at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const requests = await prepare(page);
        const city = page.getByRole("combobox", { name: /المدينة/ });
        await expect(page.locator("#checkout-city-search")).toHaveCount(0);
        await expect(page.locator("form input, form textarea")).toHaveCount(4);
        await city.fill("طنج");
        await expect(page.getByRole("option", { name: /طنجة/ })).toBeVisible();
        await city.press("ArrowDown");
        await expect(city).toHaveAttribute("aria-activedescendant", "checkout-city-option-0");
        await city.press("Enter");
        await expect(city).toHaveValue("طنجة");
        await expect(city).toHaveAttribute("aria-expanded", "false");
        await city.fill("Tanger");
        await page.getByRole("option", { name: /طنجة/ }).click();
        await expect(city).toHaveValue("طنجة");
        await city.fill("ville inexistante");
        await city.press("Enter");
        expect(requests).toHaveLength(0);
        await city.press("Escape");
        await city.press("Tab");
        await expect(city).toHaveAttribute("aria-invalid", "true");
        await city.fill("Rabat");
        await city.press("ArrowDown");
        await city.press("Enter");
        await expect(city).toHaveValue("الرباط");
        await expect(city).toHaveAttribute("aria-invalid", "false");
        await page.getByLabel("الاسم الكامل", { exact: true }).fill("Client fictif");
        await page.getByLabel("رقم الهاتف", { exact: true }).fill("0612345678");
        await page
            .getByLabel("عنوان التوصيل", { exact: true })
            .fill("Adresse fictive, ne pas livrer");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({
            path: info.outputPath(`checkout-entry-${width}.png`),
            fullPage: true,
        });
        expect(requests).toHaveLength(0);
    });
    test(`Phone typing stays stable, formats on blur and submits a carrier-compatible number at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        const requests = await prepare(page);
        const phone = page.getByLabel("رقم الهاتف", { exact: true });
        await phone.fill("0612345678");
        await phone.press("Home");
        await phone.press("ArrowRight");
        await phone.press("ArrowRight");
        await phone.press("9");
        await expect(phone).toHaveValue("06912345678");
        expect(await phone.evaluate((e: HTMLInputElement) => e.selectionStart)).toBe(3);
        await phone.fill("٠٦١٢٣٤٥٦٧٨");
        await expect(phone).toHaveValue("0612345678");
        await phone.press("Tab");
        await expect(phone).toHaveValue("06 12 34 56 78");
        await phone.fill("00212 612 34 56 78");
        await phone.press("Tab");
        await expect(phone).toHaveValue("+212 6 12 34 56 78");
        await expect(phone).toHaveAttribute("aria-invalid", "false");
        await page.getByLabel("الاسم الكامل", { exact: true }).fill("Client fictif");
        await page.locator("#checkout-city").fill("Tanger");
        await page.getByLabel("عنوان التوصيل", { exact: true }).fill("Adresse fictive de test 1");
        await page.getByRole("button", { name: "تأكيد الطلب", exact: true }).click();
        await expect.poll(() => requests.length).toBe(1);
        expect(requests[0].customer).toMatchObject({
            phone: "+212612345678",
            city: "tangier",
            street: "Adresse fictive de test 1",
        });
        expect(requests[0].expectedTotal).toBe(230);
        await expect(phone).toHaveValue("+212 6 12 34 56 78");
    });
    test(`Invalid input is explained on blur and clears while correcting at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        const requests = await prepare(page);
        const name = page.getByLabel("الاسم الكامل", { exact: true }),
            phone = page.getByLabel("رقم الهاتف", { exact: true });
        await expect(page.locator(".checkout-field-error")).toHaveCount(0);
        await name.fill("Ab");
        await name.press("Tab");
        await expect(name).toHaveAttribute("aria-invalid", "true");
        await name.fill("Client fictif");
        await expect(name).toHaveAttribute("aria-invalid", "false");
        await phone.fill("0600000000");
        await phone.press("Tab");
        await expect(phone).toHaveValue("0600000000");
        await expect(phone).toHaveAttribute("aria-invalid", "true");
        await phone.fill("07 12 34 56 78");
        await expect(phone).toHaveAttribute("aria-invalid", "false");
        expect(requests).toHaveLength(0);
    });
}

test.describe("Touch and short-screen city selection", () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 450 } });
    test("Tapping a result selects it without losing the dropdown before the tap", async ({
        page,
    }) => {
        const requests = await prepare(page);
        const city = page.locator("#checkout-city");
        await city.fill("Tanger");
        await page.getByRole("option", { name: /طنجة/ }).tap();
        await expect(city).toHaveValue("طنجة");
        await expect(city).toHaveAttribute("aria-expanded", "false");
        expect(requests).toHaveLength(0);
    });
    test("Keyboard navigation scrolls the results list and Escape keeps the typed city", async ({
        page,
    }) => {
        const requests = await prepare(page);
        const city = page.locator("#checkout-city");
        await city.focus();
        await city.press("ArrowUp");
        await expect(city).toHaveAttribute("aria-activedescendant", "checkout-city-option-7");
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const menu = document
                        .querySelector(".checkout-city-menu")!
                        .getBoundingClientRect();
                    const header = document.querySelector("header")!.getBoundingClientRect();
                    const footer = document
                        .querySelector(".checkout-submit-bar")!
                        .getBoundingClientRect();
                    return menu.top >= header.bottom && menu.bottom <= footer.top;
                }),
            )
            .toBe(true);
        await expect
            .poll(() => page.getByRole("listbox").evaluate((e) => e.scrollTop))
            .toBeGreaterThan(0);
        await city.press("Escape");
        await expect(city).toHaveAttribute("aria-expanded", "false");
        await expect(city).toHaveValue("");
        expect(requests).toHaveLength(0);
    });
});
