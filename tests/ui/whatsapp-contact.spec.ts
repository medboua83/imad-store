import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
    test(`Floating WhatsApp contact respects store navigation at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/");
        const whatsapp = page.locator(".store-whatsapp-float");
        await expect(whatsapp).toBeVisible();
        await expect(whatsapp).toHaveAccessibleName("مساعدة عبر واتساب — نافذة جديدة");
        await expect(whatsapp).toHaveAttribute("href", "https://wa.me/message/M44N6KT35MW4N1");
        await expect(whatsapp).toHaveAttribute("target", "_blank");
        const button = (await whatsapp.boundingBox())!;
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
        if (width < 768) {
            const dock = (await page.locator(".mobile-dock").boundingBox())!;
            expect(button.y + button.height).toBeLessThan(dock.y);
        }

        await page.locator("#store-cart-trigger").click();
        await expect(page.locator("#store-cart")).toBeVisible();
        await expect(whatsapp).toBeHidden();
        await page.keyboard.press("Escape");
        await expect(whatsapp).toBeVisible();

        await page.goto("/shop?category=manteau-femme");
        await expect(whatsapp).toBeVisible();
        await page.goto("/products/fixture-sabot");
        if (width < 768) await expect(whatsapp).toBeHidden();
        else await expect(whatsapp).toBeVisible();
        await page.goto("/checkout");
        await expect(whatsapp).toHaveCount(0);
    });
}
