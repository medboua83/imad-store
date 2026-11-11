import { test, expect } from "@playwright/test";

for (const width of [1024, 1440])
    test(`Hover zoom follows the pointer without moving the product layout at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/products/fixture-gallery");
        const stage = page.locator(".gallery-stage");
        const photo = stage.locator("img");
        await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
        await stage.scrollIntoViewIfNeeded();
        const original = await photo.getAttribute("src");
        const box = (await stage.boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4);
        await expect(stage).toHaveAttribute("data-hover-zoom", "true");
        await expect(photo).toHaveCSS("transform", "matrix(2, 0, 0, 2, 0, 0)");
        const firstOrigin = await photo.evaluate((image) => getComputedStyle(image).transformOrigin);
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7);
        await expect.poll(() => photo.evaluate((image) => getComputedStyle(image).transformOrigin)).not.toBe(firstOrigin);
        expect(await stage.boundingBox()).toEqual(box);
        await expect(photo).toHaveAttribute("src", original!);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`hover-zoom-${width}.png`) });
        await page.mouse.move(0, 0);
        await expect(stage).not.toHaveAttribute("data-hover-zoom", "true");
        await expect(photo).toHaveCSS("transform", "none");
        await page.getByRole("button", { name: "تكبير صورة المنتج", exact: true }).click();
        await expect(stage).not.toHaveAttribute("data-hover-zoom", "true");
        await expect(page.locator(".gallery-dialog img")).toHaveAttribute("src", original!);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "تكبير صورة المنتج", exact: true })).toBeFocused();
    });

test("A color change resets the zoom and keeps the correct original photo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/products/fixture-color-photos");
    const stage = page.locator(".gallery-stage");
    const photo = stage.locator("img");
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await stage.hover();
    await expect(stage).toHaveAttribute("data-hover-zoom", "true");
    // Keyboard selection changes the image without first moving the mouse out of the frame.
    await page.getByRole("button", { name: "بني", exact: true }).press("Enter");
    await expect(photo).toHaveJSProperty("src", new URL("/images/catalogue-test/abaya.webp", page.url()).href);
    await expect(stage).not.toHaveAttribute("data-hover-zoom", "true");
    await expect(photo).toHaveCSS("transform", "none");
    await stage.hover({ position: { x: 120, y: 120 } });
    await expect(stage).toHaveAttribute("data-hover-zoom", "true");
    await page.getByRole("button", { name: "تكبير صورة المنتج", exact: true }).click();
    await expect(page.locator(".gallery-dialog img")).toHaveJSProperty("src", new URL("/images/catalogue-test/abaya.webp", page.url()).href);
});

test("Reduced motion keeps an instant hover zoom without an animated transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/products/fixture-sabot");
    const stage = page.locator(".gallery-stage");
    await expect.poll(() => stage.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await stage.hover();
    await expect(stage.locator("img")).toHaveCSS("transform", "matrix(2, 0, 0, 2, 0, 0)");
    await expect(stage.locator("img")).toHaveCSS("transition-duration", "0s");
});

for (const width of [320, 390])
    test(`Touch keeps page scrolling and explicit photo enlargement at ${width}px`, async ({ browser }, info) => {
        const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        try {
            await page.goto("http://127.0.0.1:3131/products/fixture-gallery");
            const stage = page.locator(".gallery-stage");
            await expect.poll(() => stage.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
            await stage.tap();
            await expect(stage).not.toHaveAttribute("data-hover-zoom", "true");
            await expect(stage.locator("img")).toHaveCSS("transform", "none");
            await expect(stage).toHaveCSS("touch-action", "pan-y pinch-zoom");
            await page.getByRole("button", { name: "تكبير صورة المنتج", exact: true }).tap();
            await expect(page.locator(".gallery-dialog")).toBeVisible();
            await expect(page.locator(".gallery-dialog img")).toHaveJSProperty("src", new URL("/images/catalogue-test/sac.webp", page.url()).href);
            await page.screenshot({ path: info.outputPath(`touch-enlarge-${width}.png`) });
            await page.getByRole("button", { name: "إغلاق الصورة", exact: true }).tap();
            await expect(page.locator(".gallery-dialog")).not.toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        } finally {
            await context.close();
        }
    });

test("An unavailable photo never activates a zoom of the empty placeholder", async ({ page }) => {
    await page.route("**/images/catalogue-test/sac.webp", (route) => route.abort());
    await page.goto("/products/fixture-sabot");
    const stage = page.locator(".gallery-stage");
    await expect(stage.locator("img")).toHaveCount(0);
    await stage.hover();
    await expect(stage).not.toHaveAttribute("data-hover-zoom", "true");
    await expect(stage.getByText("الصورة قيد التحضير", { exact: true })).toBeVisible();
});
