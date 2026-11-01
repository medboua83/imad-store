import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`Product link copy is canonical and preserves the purchase at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__copiedProduct = text;
          },
        },
      });
    });
    await page.goto("/products/fixture-manual?stats_test=1&utm_source=test#details");
    const share = page.getByRole("button", { name: "مشاركة المنتج", exact: true });
    await expect(share).toBeVisible();
    await expect(share).toHaveAttribute("aria-busy", "false");
    const target = new URL("/products/fixture-manual", page.url()).href;
    await share.click();
    await expect(page.getByRole("status", { name: "حالة مشاركة المنتج", exact: true })).toHaveText(
      "تم نسخ رابط المنتج.",
    );
    expect(await page.evaluate(() => (window as any).__copiedProduct)).toBe(target);
    await expect(share).toBeFocused();
    await page.locator(".product-identity").screenshot({ path: info.outputPath(`product-share-feedback-${width}.png`) });
    await expect(page.locator(".purchase-price")).toContainText("230.00");
    await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
    await expect(page.locator(".purchase-price")).toContainText("400.00");
    await page.screenshot({ path: info.outputPath(`product-share-${width}.png`) });
    await page.goto("/products/fixture-premium?utm_source=other");
    await page.getByRole("button", { name: "مشاركة المنتج", exact: true }).click();
    expect(await page.evaluate(() => (window as any).__copiedProduct)).toBe(
      new URL("/products/fixture-premium", page.url()).href,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await page.locator(".cart-dialog[open]").count()).toBe(0);
  });
}

test("Native sharing uses the product title and URL and cancellation never copies", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__shareCalls = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as any).__shareCalls.push(data);
        throw new DOMException("User cancelled", "AbortError");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          (window as any).__unexpectedCopy = true;
        },
      },
    });
  });
  await page.goto("/products/fixture-manual?utm_source=test");
  await page.getByRole("button", { name: "مشاركة المنتج", exact: true }).click();
  await expect(page.getByRole("status", { name: "حالة مشاركة المنتج", exact: true })).toHaveText(
    "تم إلغاء المشاركة.",
  );
  expect(await page.evaluate(() => (window as any).__shareCalls)).toEqual([
    { title: "صابو تجريبي", url: new URL("/products/fixture-manual", page.url()).href },
  ]);
  expect(await page.evaluate(() => Boolean((window as any).__unexpectedCopy))).toBe(false);
  await expect(page.getByRole("button", { name: "مشاركة المنتج", exact: true })).toBeEnabled();
});

test("A pending native share prevents repeats and does not claim delivery", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__shareCount = 0;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => {
        (window as any).__shareCount++;
        return new Promise<void>((resolve) => {
          (window as any).__finishShare = resolve;
        });
      },
    });
  });
  await page.goto("/products/fixture-manual");
  const share = page.getByRole("button", { name: "مشاركة المنتج", exact: true });
  await share.click();
  await expect(share).toBeDisabled();
  await expect(share).toHaveAttribute("aria-busy", "true");
  expect(await page.evaluate(() => (window as any).__shareCount)).toBe(1);
  await page.evaluate(() => (window as any).__finishShare());
  await expect(share).toBeEnabled();
  await expect(page.getByRole("status", { name: "حالة مشاركة المنتج", exact: true })).toHaveText(
    "يمكنكم مشاركة الرابط مجدداً.",
  );
});

test("Blocked sharing and clipboard offer a selectable link without false success", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Blocked", "NotAllowedError");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Blocked", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/products/fixture-manual?stats_test=1");
  await page.getByRole("button", { name: "مشاركة المنتج", exact: true }).click();
  const field = page.getByRole("textbox", { name: "رابط المنتج", exact: true });
  await expect(field).toHaveValue(new URL("/products/fixture-manual", page.url()).href);
  const copy = page.getByRole("button", { name: "نسخ رابط المنتج", exact: true });
  await copy.click();
  await expect(page.getByRole("status", { name: "حالة مشاركة المنتج", exact: true })).toHaveText(
    "تعذر النسخ تلقائياً. حددوا الرابط وانسخوه يدوياً.",
  );
  await field.focus();
  expect(
    await field.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!),
  ).toBe((await field.inputValue()).length);
  await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("product-share-fallback-320.png") });
});
