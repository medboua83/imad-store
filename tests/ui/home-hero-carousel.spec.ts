import { test, expect } from "@playwright/test";
import { defaultSiteContent } from "@imad-store/shared";

for (const width of [320, 390, 1440]) {
    test(`Home hero switches product, original photo and link together at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: width > 767 ? 1000 : 844 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/?stats_test=1");
        const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
        const photo = hero.locator(".hero-photo");
        const link = hero.locator(".hero-product-link");
        await expect(photo).toHaveAttribute("src", /sac.webp/);
        await expect(link).toHaveAttribute("href", "/products/fixture-sabot");
        await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 3");
        const height = (await hero.boundingBox())!.height;
        await hero.getByRole("button", { name: "المنتج التالي", exact: true }).click();
        await expect(photo).toHaveAttribute("src", /abaya.webp/);
        await expect(link).toHaveAttribute("href", "/products/fixture-premium");
        await expect(hero.locator(".hero-product-price")).toContainText("300");
        await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
        expect(Math.abs((await hero.boundingBox())!.height - height)).toBeLessThan(2);
        await hero.getByRole("button", { name: "المنتج التالي", exact: true }).click();
        await expect(link).toHaveAttribute("href", "/products/fixture-accessory");
        await hero.getByRole("button", { name: "المنتج التالي", exact: true }).click();
        await expect(link).toHaveAttribute("href", "/products/fixture-sabot");
        await hero.getByRole("button", { name: "المنتج السابق", exact: true }).click();
        await expect(link).toHaveAttribute("href", "/products/fixture-accessory");
        await expect(hero.locator("img")).toHaveCount(1);
        for (const button of await hero.getByRole("button").all()) {
            const box = (await button.boundingBox())!;
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath(`carousel-${width}.png`) });
        await link.click();
        await expect(page).toHaveURL(/\/products\/fixture-accessory/);
    });
}

test("Automatic hero rotation pauses for hover, keyboard and explicit pause", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/?stats_test=1");
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
    const count = hero.locator(".hero-slide-count");
    const summary = hero.locator(".hero-product-summary");
    await expect(
        hero.getByRole("button", { name: "إيقاف العرض التلقائي", exact: true }),
    ).toBeVisible();
    await expect(summary).toHaveAttribute("aria-live", "off");
    await page.clock.fastForward(7500);
    await expect(count).toHaveText("2 / 3");
    await hero.hover();
    await page.clock.fastForward(15000);
    await expect(count).toHaveText("2 / 3");
    await page.mouse.move(0, 0);
    await expect(summary).toHaveAttribute("aria-live", "off");
    await page.clock.fastForward(7500);
    await expect(count).toHaveText("3 / 3");
    await hero.getByRole("button", { name: "إيقاف العرض التلقائي", exact: true }).click();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(15000);
    await expect(count).toHaveText("3 / 3");
    await hero.getByRole("button", { name: "تشغيل العرض التلقائي", exact: true }).click();
    await page.mouse.move(0, 0);
    await expect(hero).toBeInViewport({ ratio: 1 });
    await expect(summary).toHaveAttribute("aria-live", "off");
    await page.clock.fastForward(7500);
    await expect(count).toHaveText("1 / 3");
    await page.keyboard.press("Tab");
    await hero.locator(".hero-product-link").focus();
    await expect(
        hero.getByRole("button", { name: "تشغيل العرض التلقائي", exact: true }),
    ).toBeVisible();
    await page.clock.fastForward(15000);
    await expect(count).toHaveText("1 / 3");
});

test("An offscreen hero stops rotating and resumes when it is visible again", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/?stats_test=1");
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
    const summary = hero.locator(".hero-product-summary");
    await expect(summary).toHaveAttribute("aria-live", "off");
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.clock.fastForward(100);
    await expect(summary).toHaveAttribute("aria-live", "polite");
    await page.clock.fastForward(15000);
    await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 3");
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.clock.fastForward(100);
    await expect(summary).toHaveAttribute("aria-live", "off");
    await page.clock.fastForward(7500);
    await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
});

test("Reduced motion keeps the hero still with manual controls", async ({ page }) => {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?stats_test=1");
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
    await page.clock.fastForward(22000);
    await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 3");
    await expect(hero.getByRole("button", { name: /العرض التلقائي/ })).toHaveCount(0);
    await hero.getByRole("button", { name: "المنتج التالي", exact: true }).click();
    await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
});

for (const custom of [false, true]) {
    test(`Content preview preserves ${custom ? "a custom campaign image" : "an empty catalogue"} without autoplay`, async ({
        page,
    }) => {
        await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-hero-preview"));
        await page.route("**/api/**", (route) => {
            if (route.request().method() !== "GET") return route.fulfill({ status: 405 });
            const path = new URL(route.request().url()).pathname;
            const content = {
                ...defaultSiteContent,
                ...(custom ? { heroImage: "/images/catalogue-test/chale.webp" } : {}),
            };
            return route.fulfill({
                json: {
                    success: true,
                    data:
                        path === "/api/content/admin"
                            ? {
                                  draft: content,
                                  published: content,
                                  revision: 1,
                                  canRollback: false,
                              }
                            : [],
                    total: 0,
                    unread: 0,
                },
            });
        });
        await page.goto("/admin?tab=content");
        await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
        const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
        await expect(hero.locator(".hero-photo")).toHaveAttribute(
            "src",
            custom ? /chale.webp/ : /abaya.webp/,
        );
        await expect(hero.locator(".hero-product-link")).toHaveAttribute("href", "/shop");
        await expect(hero.locator(".hero-product-link")).toHaveAttribute("target", "_blank");
        await expect(hero.getByRole("button")).toHaveCount(0);
    });
}
