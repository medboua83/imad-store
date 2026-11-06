import { test, expect, type Page } from "@playwright/test";
import { defaultSiteContent } from "@imad-store/shared";

const category = {
    id: "111111111111111111111111",
    slug: "mens-clogs",
    nameFr: "Catégorie conservée",
    nameAr: "فئة أصلية",
    nameEn: "Original category",
};
const product = {
    id: "222222222222222222222222",
    slug: "original-fixture",
    nameFr: "Article original",
    nameAr: "منتج أصلي",
    nameEn: "Original item",
    descriptionFr: "Texte conservé",
    descriptionAr: "وصف أصلي",
    descriptionEn: "Original description",
    category,
    price: 230,
    status: "ACTIVE",
    freeShipping: true,
    images: ["/images/catalogue-test/sac.webp"],
    variants: [
        {
            id: "333333333333333333333333",
            sku: "ORIGINAL-SKU",
            color: "#000000",
            colorNameFr: "Noir",
            colorNameAr: "أسود",
            colorNameEn: "Black",
            size: "40",
            stock: 5,
        },
    ],
};

async function mockAdmin(page: Page) {
    const writes: { path: string; body: any }[] = [];
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-language-fixture"));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            path = new URL(request.url()).pathname;
        if (request.method() !== "GET") writes.push({ path, body: request.postDataJSON() });
        let data: any = [],
            extra: Record<string, unknown> = {};
        if (path === "/api/products/admin/catalog") data = [product];
        else if (path === "/api/categories") data = [category];
        else if (path === "/api/orders")
            data = [
                {
                    id: "777777777777777777777777",
                    customerName: "Client fictif",
                    customerPhone: "+212600000099",
                    city: "Rabat",
                    status: "PENDING",
                    paymentMethod: "COD",
                    paymentStatus: "PENDING",
                    totalAmount: 230,
                    shippingCost: 0,
                    createdAt: "2026-11-06T10:00:00Z",
                    items: [],
                },
            ];
        else if (path === "/api/settings")
            data = {
                shippingCost: 30,
                freeShippingMin: 500,
                codEnabled: true,
                metaPixelEnabled: false,
            };
        else if (path === "/api/content/admin")
            data = {
                draft: defaultSiteContent,
                published: defaultSiteContent,
                revision: 1,
                canRollback: false,
            };
        else if (path === "/api/integrations/deskcomm")
            data = { configured: false, enabled: false, updatedAt: null };
        else if (path === "/api/integrations/olivraison")
            data = {
                saved: false,
                enabled: false,
                autoPickup: false,
                configured: false,
                activatedAt: null,
                pickupAddress: { company: "", streetAddress: "", city: "", phone: "" },
                cityMapping: {},
            };
        else if (path === "/api/analytics/summary")
            data = {
                days: 7,
                visits: 10,
                pageViews: 15,
                productViews: 5,
                convertedVisits: 1,
                orderRate: 10,
                attributedOrders: 1,
                trackingSince: null,
                products: [],
            };
        else if (path === "/api/products/" + product.id) data = product;
        if (path === "/api/notifications") extra = { unread: 0 };
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                success: true,
                data,
                total: Array.isArray(data) ? data.length : 0,
                page: 1,
                totalPages: 1,
                ...extra,
            }),
        });
    });
    return writes;
}

async function tab(page: Page, name: string) {
    const menu = page.locator(".admin-mobile-menu");
    if ((await menu.isVisible()) && (await menu.getAttribute("aria-expanded")) === "false")
        await menu.click();
    await page.locator("#admin-navigation").getByRole("button", { name, exact: true }).click();
}

for (const width of [390, 1440]) {
    test(`Arabic admin preserves product data and submits unchanged API fields at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const writes = await mockAdmin(page);
        await page.goto("/admin");
        await expect(
            page.getByRole("heading", { name: "Vue d’ensemble", exact: true }),
        ).toBeVisible();
        const language = page.getByRole("combobox", {
            name: "Langue de l’administration / لغة لوحة الإدارة",
        });
        await language.selectOption("ar");
        await expect(page.locator(".admin-workspace")).toHaveAttribute("dir", "rtl");
        await expect(page.getByRole("heading", { name: "نظرة عامة", exact: true })).toBeVisible();
        await tab(page, "المنتجات");
        await page.getByRole("button", { name: "تعديل Article original", exact: true }).click();
        const nameFr = page.getByLabel("الاسم الفرنسي", { exact: true });
        await nameFr.fill("Texte français conservé");
        await page.getByLabel("الاسم العربي", { exact: true }).fill("اسم عربي محفوظ");
        await language.selectOption("fr");
        await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue(
            "Texte français conservé",
        );
        await expect(page.getByLabel("Nom arabe", { exact: true })).toHaveValue("اسم عربي محفوظ");
        await language.selectOption("ar");
        expect(writes).toHaveLength(0);
        await page.getByRole("button", { name: "حفظ المنتج", exact: true }).click();
        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0].path).toBe("/api/products/" + product.id);
        expect(writes[0].body).toMatchObject({
            nameFr: "Texte français conservé",
            nameAr: "اسم عربي محفوظ",
            status: "ACTIVE",
            price: 230,
            freeShipping: true,
        });
        expect(writes[0].body.variants[0]).toMatchObject({
            sku: "ORIGINAL-SKU",
            colorNameFr: "Noir",
            colorNameAr: "أسود",
            colorNameEn: "Black",
            size: "40",
            stock: 5,
        });
        await expect(page.getByText("حُفظ المنتج. الكتالوج محدّث.", { exact: true })).toBeVisible();
        for (const name of [
            "الطلبات",
            "الفئات",
            "الإعدادات",
            "ربط CRM",
            "الإحصاءات",
            "محتوى الموقع",
        ]) {
            await tab(page, name);
            await expect(page.locator(".admin-page-heading h1")).toHaveText(name);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
        }
        await tab(page, "المنتجات");
            if (width > 767) {
                const active = page.locator('#admin-navigation button[aria-current="page"]');
                await active.hover();
                const colors = await active.evaluate(element => ({
                    text: getComputedStyle(element).color,
                    background: getComputedStyle(element).backgroundColor,
                    parent: getComputedStyle(element.closest("aside")!).backgroundColor,
                }));
                const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
                const foreground = rgb(colors.text), background = rgb(colors.background), parent = rgb(colors.parent);
                const alpha = background[3] ?? 1;
                const luminance = (value: number[]) => value.slice(0, 3).map(channel => {
                    const n = channel / 255;
                    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
                }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
                const a = luminance(foreground), b = luminance(background.map((value, index) => value * alpha + parent[index] * (1 - alpha)));
                expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
            }
        await page.screenshot({ path: info.outputPath(`arabic-admin-${width}.png`) });
        expect(await page.evaluate(() => localStorage.getItem("adminToken"))).toBe(
            "isolated-language-fixture",
        );
        expect(writes).toHaveLength(1);
        expect(errors).toEqual([]);
    });
}

test("Language selection persists on login without exposing credentials", async ({ page }) => {
    await page.goto("/admin");
    const language = page.getByRole("combobox", {
        name: "Langue de l’administration / لغة لوحة الإدارة",
    });
    await language.selectOption("ar");
    await expect(page.locator(".admin-auth")).toHaveAttribute("lang", "ar");
    await expect(page.getByLabel("البريد الإلكتروني", { exact: true })).toBeVisible();
    await page.reload();
    await expect(language).toHaveValue("ar");
    await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveAttribute(
        "type",
        "password",
    );
    await language.selectOption("fr");
    await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
});
