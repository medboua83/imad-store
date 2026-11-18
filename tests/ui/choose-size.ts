import type { Page } from "@playwright/test";

/** Existing purchase regressions now make the shopper's required choice explicitly. */
export async function chooseSizeIfRequired(page: Page) {
    if (!new URL(page.url()).pathname.startsWith("/products/")) return;
    if (await page.locator("dialog[open]").count()) return;
    const options = page.locator(".product-options");
    if (!(await options.count())) return;
    const choose = options.getByRole("button", { name: "اختاروا المقاس", exact: true });
    if (await choose.isVisible()) {
        await options.locator(".size-options button:not(:disabled)").first().click();
    }
}
