import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
    test(`Home catalogue stays balanced, legible and navigable at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: width > 767 ? 1000 : 844 });
        const writes: string[] = [];
        await page.route("**/api/**", (route) => {
            if (new URL(route.request().url()).pathname === "/api/analytics/events")
                return route.fulfill({ status: 204 });
            if (route.request().method() !== "GET") {
                writes.push(route.request().url());
                return route.fulfill({ status: 405 });
            }
            return route.continue();
        });
        await page.goto("/?stats_test=1");
        await page.evaluate(() => document.fonts.ready);
        const cards = page.locator("main .catalog-card");
        await expect(cards).toHaveCount(3);
        for (const cover of await cards.locator(".catalog-card-image").all()) {
            await expect(cover).toHaveCSS("aspect-ratio", "3 / 4");
        }
        await expect(cards.first().locator(".catalog-card-image img")).toHaveCSS(
            "object-fit",
            "contain",
        );
        const cta = page.locator('.hero-collection-link[href="#collections"]');
        const collections = page.locator("#collections");
        const hero = page.locator(".editorial-hero");
        const frame = page.locator(".home-hero-carousel");
        // The inherited inner width used to leave a 48px empty strip beside the photo.
        const frameBox = (await frame.boundingBox())!;
        const heroBox = (await hero.boundingBox())!;
        const innerFrame = await frame.evaluate((el) => ({
            left: el.clientLeft,
            width: el.clientWidth,
        }));
        expect(Math.abs(heroBox.x - frameBox.x - innerFrame.left)).toBeLessThan(1);
        expect(Math.abs(heroBox.width - innerFrame.width)).toBeLessThan(1);
        await expect(hero.locator(".hero-eyebrow bdi")).toHaveText("IMAD Mode");
        await expect(hero.getByRole("link")).toHaveCount(2);
        await expect(hero.locator("h1")).toHaveText("صابو تجريبي");
        await expect(hero.locator(".hero-product-link")).toHaveAccessibleName("اكتشفوا هذا المنتج");
        await expect(hero.locator(".hero-product-link")).toBeInViewport({ ratio: 1 });
        await expect(cta).toHaveAccessibleName("شاهدوا المجموعة كاملة");
        await expect(cta).toBeInViewport({ ratio: 1 });
        expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expect(hero.locator("img")).toHaveCount(1);
        await expect(hero.locator(".hero-photo")).toHaveAttribute("src", /sac.webp/);
        await expect(hero.locator(".hero-photo")).toHaveCSS("object-fit", "contain");
        await expect(hero.locator(".hero-visual")).toHaveCSS("aspect-ratio", "3 / 4");
        const copy = (await hero.locator(".hero-copy").boundingBox())!;
        const visual = (await hero.locator(".hero-visual").boundingBox())!;
        expect(Math.abs(copy.y - visual.y)).toBeLessThan(1);
        expect(Math.abs(visual.x + visual.width - copy.x)).toBeLessThan(1);
        expect((await hero.boundingBox())!.height).toBeLessThan(width < 768 ? 390 : 500);
        const featuredY = await page
            .locator(".featured-section")
            .evaluate((el) => el.getBoundingClientRect().top + scrollY);
        if (width < 768) expect(featuredY).toBeLessThan(900);
        await page.screenshot({ path: info.outputPath(`home-top-${width}.png`) });
        // Revisit an already active hash after scrolling away: this was broken with router links.
        for (let repeat = 0; repeat < 2; repeat++) {
            await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
            await cta.click();
            await expect
                .poll(() =>
                    collections.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
                )
                .toBeLessThan(170);
            expect(
                await collections.evaluate((el) => el.getBoundingClientRect().top),
            ).toBeGreaterThan(70);
        }
        await expect(collections).toBeFocused();
        const sections = collections.getByRole("navigation", { name: "أقسام المتجر" });
        await expect(sections.getByRole("link", { name: /Femme/ })).toHaveAttribute(
            "href",
            "/shop?section=women",
        );
        await expect(sections.getByRole("link", { name: /Homme/ })).toHaveAttribute(
            "href",
            "/shop?section=men",
        );
        for (const section of await sections.getByRole("link").all()) {
            const box = await section.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeLessThan(130);
        }
        const categoryGrid = collections.getByRole("navigation", { name: "فئات المتجر" });
        await expect(categoryGrid).toHaveCSS("--collection-columns", width < 768 ? "2" : "4");
        const categoryLinks = categoryGrid.getByRole("link");
        await expect(categoryLinks).toHaveCount(2);
        await expect(categoryLinks.last()).toHaveAttribute("href", "/shop?category=manteau-femme");
        for (const link of await categoryLinks.all()) {
            const photo = link.locator(".collection-photo");
            await expect(photo).toHaveCSS("aspect-ratio", "1 / 1");
            await expect(photo.locator("img")).toHaveCSS("object-fit", "cover");
            const bounds = await link.boundingBox();
            const image = await photo.boundingBox();
            expect(image!.width).toBe(width < 360 ? 48 : 56);
            expect(image!.height).toBe(image!.width);
            expect(bounds!.height).toBeLessThanOrEqual(76);
            expect(image!.x + image!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
            const label = await link.locator(".collection-name").boundingBox();
            expect(label!.x + label!.width).toBeLessThanOrEqual(image!.x);
        }
        if (width > 767) {
            for (const selector of [".collection-grid", ".featured-section .catalog-grid"]) {
                const centered = await page.locator(selector).evaluate((el) => {
                    const children = [...el.children].map((e) => e.getBoundingClientRect());
                    const bounds = el.getBoundingClientRect();
                    return Math.abs(
                        (Math.min(...children.map((r) => r.left)) +
                            Math.max(...children.map((r) => r.right))) /
                            2 -
                            (bounds.left + bounds.right) / 2,
                    );
                });
                expect(centered).toBeLessThan(2);
            }
        }
        // Rows with/without free delivery or quantity offers must keep their action aligned.
        const rows = await cards.evaluateAll((elements) =>
            elements.map((el) => ({
                top: Math.round(el.getBoundingClientRect().top),
                bottom: Math.round(
                    el.querySelector(".card-bottom a")!.getBoundingClientRect().bottom,
                ),
            })),
        );
        for (const row of rows) {
            const sameRow = rows.filter((other) => Math.abs(other.top - row.top) < 2);
            expect(
                Math.max(...sameRow.map((r) => r.bottom)) -
                    Math.min(...sameRow.map((r) => r.bottom)),
            ).toBeLessThanOrEqual(2);
        }
        expect(
            await cards
                .first()
                .locator(".product-size-preview")
                .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        ).toBeGreaterThanOrEqual(13);
        await expect(
            page.locator(".featured-section .catalog-card-image img[src$='abaya.webp']"),
        ).toHaveCount(1);
        await expect(page.locator(".home-shopping-guide")).not.toHaveAttribute("open", "");
        await page.locator(".home-shopping-guide summary").click();
        await expect(page.locator(".home-shopping-guide .guide-grid")).toBeVisible();
        await page.locator(".home-shopping-guide summary").click();
        await expect(page.locator(".footer-service-strip")).toHaveCount(0);
        const footer = page.getByRole("contentinfo");
        const footerShop = footer.getByRole("navigation", { name: "المتجر", exact: true });
        const footerHelp = footer.getByRole("navigation", { name: "خدمة العملاء", exact: true });
        await expect(footerShop.getByRole("link", { name: "كل المنتجات" })).toHaveAttribute(
            "href",
            "/shop",
        );
        await expect(footerShop.locator('a[href="/shop?category=manteau-femme"]')).toBeVisible();
        await expect(footerHelp.getByRole("link", { name: "الاستبدال والإرجاع" })).toHaveAttribute(
            "href",
            "/returns",
        );
        await expect(footer.getByRole("link", { name: "سياسة الخصوصية" })).toHaveCount(1);
        const footerBrand = (await footer.locator(".footer-brand").boundingBox())!;
        const shopBox = (await footerShop.boundingBox())!;
        const helpBox = (await footerHelp.boundingBox())!;
        expect(Math.abs(shopBox.y - helpBox.y)).toBeLessThan(1);
        expect(helpBox.x + helpBox.width).toBeLessThanOrEqual(shopBox.x);
        if (width < 768) {
            expect(footerBrand.y + footerBrand.height).toBeLessThan(shopBox.y);
        } else {
            expect(Math.abs(footerBrand.y - shopBox.y)).toBeLessThan(1);
        }
        await expect(page.locator(".footer-socials a")).toHaveCount(4);
        for (const network of ["WhatsApp", "Instagram", "Facebook", "TikTok"]) {
            const social = page
                .locator(".footer-socials")
                .getByRole("link", { name: `${network} — نافذة جديدة`, exact: true });
            await expect(social).toHaveAttribute("title", network);
            await expect(social).toHaveAttribute("rel", "noopener noreferrer");
            expect(await social.innerText()).toBe("");
            const box = await social.boundingBox();
            expect(box!.width).toBeGreaterThanOrEqual(44);
            expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.locator(".footer-socials").scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`social-icons-${width}.png`) });
        if (width < 768) {
            await page.getByRole("button", { name: "فتح القائمة", exact: true }).click();
            const menu = page.locator("#store-menu");
            const coat = menu.locator('a[href="/shop?category=manteau-femme"] img');
            await expect(coat).toBeVisible();
            await expect(coat).toHaveAttribute("src", /abaya.webp/);
            await expect
                .poll(() =>
                    coat.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
                )
                .toBe(true);
            await page.keyboard.press("Escape");
            await expect(menu).not.toBeVisible();
            await expect(
                page.getByRole("button", { name: "فتح القائمة", exact: true }),
            ).toBeFocused();
        }
        await page.locator(".featured-section").scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`home-catalogue-${width}.png`) });
        expect(writes).toEqual([]);
    });
}
