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
async function seed(page: Page) {
    await page.addInitScript(
        (value) =>
            localStorage.setItem(
                "imad-store-cart",
                JSON.stringify({ state: { items: [value] }, version: 0 }),
            ),
        item,
    );
}
async function fill(page: Page) {
    await page.getByRole("textbox", { name: "الاسم الكامل", exact: true }).fill("اختبار واجهة — لا شحن");
    await page.getByRole("textbox", { name: "رقم الهاتف", exact: true }).fill("0600000099");
    await page.locator("#checkout-city").selectOption("tangier");
    await page.getByRole("textbox", { name: "عنوان التوصيل", exact: true }).fill("Adresse fictive de test 1");
}

for (const width of [390, 1440]) {
    test(`Failed checkout focuses a visible error, preserves input and keeps its retry key at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 844 });
        await seed(page);
        const keys: (string | undefined)[] = [];
        await page.route("**/api/orders", (route) => {
            keys.push(route.request().headers()["idempotency-key"]);
            return route.abort("failed");
        });
        await page.goto("/checkout");
        await fill(page);
        const submit = page.getByRole("button", { name: "تأكيد الطلب", exact: true });
        await expect(submit).toBeEnabled();
        await submit.click();
        const error = page.locator(".checkout-submission-error");
        await expect(error).toContainText("تعذر الاتصال");
        await expect(error).toBeFocused();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const error = document
                        .querySelector(".checkout-submission-error")!
                        .getBoundingClientRect();
                    const header = document.querySelector("header")!.getBoundingClientRect();
                    return error.top >= header.bottom && error.bottom < innerHeight - 80;
                }),
            )
            .toBe(true);
        await expect(page.getByRole("textbox", { name: "الاسم الكامل", exact: true })).toHaveValue(
            "اختبار واجهة — لا شحن",
        );
        await expect(page.getByRole("textbox", { name: "رقم الهاتف", exact: true })).toHaveValue("0600000099");
        await expect(page.locator("#checkout-city")).toHaveValue("tangier");
        await expect(page.getByRole("textbox", { name: "عنوان التوصيل", exact: true })).toHaveValue(
            "Adresse fictive de test 1",
        );
        await expect(submit).toBeEnabled();
        await page.screenshot({ path: info.outputPath(`checkout-error-${width}.png`) });
        await submit.click();
        await expect.poll(() => keys.length).toBe(2);
        await expect(error).toBeFocused();
        expect(keys[0]).toBeTruthy();
        expect(keys[1]).toBe(keys[0]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });

    test(`A background basket error does not steal typing focus at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        await seed(page);
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.route("**/api/products/fixture-sabot", async (route) => {
            await gate;
            await route.abort();
        });
        let orders = 0;
        await page.route("**/api/orders", (route) => {
            orders++;
            return route.abort();
        });
        await page.goto("/checkout");
        const name = page.getByRole("textbox", { name: "الاسم الكامل", exact: true });
        await name.fill("Saisie fictive conservée");
        await name.focus();
        release();
        await expect(page.locator(".checkout-submission-error")).toContainText("تعذر تحديث السلة");
        await expect(name).toBeFocused();
        await expect(name).toHaveValue("Saisie fictive conservée");
        expect(orders).toBe(0);
    });

    test(`Unavailable items can be reviewed and removed without finding the collapsed summary at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 844 });
        await seed(page);
        await page.route("**/api/products/fixture-sabot", (route) =>
            route.fulfill({
                json: {
                    success: true,
                    data: {
                        id: item.productId,
                        slug: item.productSlug,
                        price: item.price,
                        images: [item.image],
                        freeShipping: true,
                        nameFr: item.nameFr,
                        nameAr: item.nameAr,
                        nameEn: item.nameEn,
                        variants: [
                            {
                                id: item.variantId,
                                size: item.size,
                                stock: 0,
                                colorNameFr: item.colorNameFr,
                                colorNameAr: item.colorNameAr,
                            },
                        ],
                    },
                },
            }),
        );
        let orders = 0;
        await page.route("**/api/orders", (route) => {
            orders++;
            return route.abort();
        });
        await page.goto("/checkout");
        const review = page.getByRole("button", { name: "مراجعة الحقيبة", exact: true });
        await expect(review).toBeVisible();
        await expect(page.getByRole("button", { name: "تأكيد الطلب", exact: true })).toBeDisabled();
        await review.click();
        const dialog = page.locator(".cart-dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.locator(".bag-stock-error")).toContainText("غير متوفر");
        await page.screenshot({ path: info.outputPath(`checkout-unavailable-${width}.png`) });
        await dialog.getByRole("button", { name: "حذف صابو تجريبي", exact: true }).click();
        await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await expect(page.locator(".checkout-empty")).toBeVisible();
        expect(orders).toBe(0);
    });
}
