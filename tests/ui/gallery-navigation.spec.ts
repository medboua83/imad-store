import { test, expect, type Page, type Locator } from "@playwright/test";

async function swipe(page: Page, target: Locator, x: number, y = 0, cancel = false) {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    const client = await page.context().newCDPSession(page);
    const startX = box.x + box.width / 2 - x / 2;
    const startY = box.y + box.height / 2 - y / 2;
    await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: startX, y: startY }],
    });
    for (let i = 1; i <= 5; i++)
        await client.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: startX + (x * i) / 5, y: startY + (y * i) / 5 }],
        });
    await client.send("Input.dispatchTouchEvent", {
        type: cancel ? "touchCancel" : "touchEnd",
        touchPoints: [],
    });
    await client.detach();
}

for (const width of [390, 1440])
    test(`Gallery keyboard controls and zoom preserve the original photos at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/products/fixture-gallery");
        const stage = page.locator(".gallery-stage");
        const photo = stage.locator("img");
        await expect(photo).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/sac.webp", page.url()).href,
        );
        const control = page
            .locator(".gallery-caption")
            .getByRole("button", { name: "الصورة التالية", exact: true });
        await control.focus();
        await control.press("Control+ArrowRight");
        await expect(photo).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/sac.webp", page.url()).href,
        );
        await control.press("ArrowRight");
        await expect(photo).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/abaya.webp", page.url()).href,
        );
        await expect(
            page.getByRole("button", { name: "عرض الصورة 2", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await control.press("End");
        await expect(photo).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/chale.webp", page.url()).href,
        );
        await control.press("ArrowRight");
        await expect(photo).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/sac.webp", page.url()).href,
        );
        await control.press("ArrowLeft");
        await expect(photo).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/chale.webp", page.url()).href,
        );
        await control.press("Home");
        await expect(photo).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/sac.webp", page.url()).href,
        );
        await page.getByRole("button", { name: "تكبير صورة المنتج", exact: true }).click();
        const dialog = page.locator(".gallery-dialog");
        await expect(dialog).toBeVisible();
        await dialog.press("End");
        await expect(dialog.locator("img")).toHaveJSProperty(
            "src",
            new URL("/images/catalogue-test/chale.webp", page.url()).href,
        );
        await dialog.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(
            page.getByRole("button", { name: "تكبير صورة المنتج", exact: true }),
        ).toBeFocused();
        await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath(`gallery-keyboard-${width}.png`) });
    });

test("Native mobile swipes change photos while vertical, cancelled and multi-touch gestures stay safe", async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/products/fixture-gallery");
    const stage = page.locator(".gallery-stage");
    const photo = stage.locator("img");
    await swipe(page, stage, -120);
    await expect(photo).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/abaya.webp", page.url()).href,
    );
    await swipe(page, stage, 120);
    await expect(photo).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/sac.webp", page.url()).href,
    );
    await swipe(page, stage, -20);
    await expect(photo).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/sac.webp", page.url()).href,
    );
    await swipe(page, stage, -120, 0, true);
    await expect(photo).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/sac.webp", page.url()).href,
    );
    await swipe(page, stage, 0, -120);
    await expect(photo).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/sac.webp", page.url()).href,
    );
    await expect(stage).toHaveCSS("touch-action", "pan-y pinch-zoom");
    const box = (await stage.boundingBox())!;
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
            { x: box.x + 80, y: box.y + 80, id: 1 },
            { x: box.x + 160, y: box.y + 80, id: 2 },
        ],
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
    await expect(photo).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/sac.webp", page.url()).href,
    );
    await page.getByRole("button", { name: "تكبير صورة المنتج", exact: true }).click();
    const zoomPhoto = page.locator(".gallery-dialog .zoom-photo");
    await swipe(page, zoomPhoto, -120);
    await expect(zoomPhoto.locator("img")).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/abaya.webp", page.url()).href,
    );
    await page.screenshot({ path: info.outputPath("gallery-touch-zoom.png") });
    await page.getByRole("button", { name: "إغلاق الصورة", exact: true }).click();
    await expect(stage.locator("img")).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/abaya.webp", page.url()).href,
    );
    await expect(
        page.getByRole("button", { name: "فتح السلة، 0 قطعة", exact: true }).first(),
    ).toBeVisible();
});

test("Failed gallery photos are skipped by keyboard navigation", async ({ page }) => {
    await page.route("**/images/catalogue-test/abaya.webp", (route) => route.abort());
    await page.goto("/products/fixture-gallery");
    const stage = page.locator(".gallery-stage");
    await expect(page.locator(".gallery-thumbnails button")).toHaveCount(2);
    const control = page
        .locator(".gallery-caption")
        .getByRole("button", { name: "الصورة التالية", exact: true });
    await control.focus();
    await control.press("End");
    await expect(stage.locator("img")).toHaveJSProperty(
        "src",
        new URL("/images/catalogue-test/chale.webp", page.url()).href,
    );
    await expect
        .poll(() =>
            stage.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
});

test("A single photo keeps normal product controls without an unnecessary gallery tab stop", async ({
    page,
}) => {
    await page.goto("/products/fixture-sabot");
    await expect(page.locator(".gallery-stage")).not.toHaveAttribute("tabindex", "0");
    await expect(page.locator(".gallery-swipe-hint")).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "تكبير صورة المنتج", exact: true }),
    ).toBeVisible();
});
