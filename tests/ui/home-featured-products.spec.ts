import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`Home products keep original photos, prices and usable actions at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
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
    const section = page.getByRole("region", { name: "مختارات من المتجر", exact: true });
    const cards = section.locator(".catalog-card");
    await expect(cards).toHaveCount(3);
    const expected = [
      {
        src: "/images/catalogue-test/sac.webp",
        href: "/products/fixture-sabot",
        price: "230.00 MAD",
      },
      {
        src: "/images/catalogue-test/abaya.webp",
        href: "/products/fixture-premium",
        price: "300.00 MAD",
      },
      {
        src: "/images/catalogue-test/sac.webp",
        href: "/products/fixture-accessory",
        price: "50.00 MAD",
      },
    ];
    for (let i = 0; i < expected.length; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      const image = card.locator(".catalog-card-image img");
      await expect
        .poll(() =>
          image.evaluate((el) => new URL(el.getAttribute("src")!, location.href).pathname),
        )
        .toBe(expected[i].src);
      await expect
        .poll(() =>
          image.evaluate(
            (e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
      await expect(image).toHaveCSS("object-fit", "contain");
      await expect(card.locator(".product-current-price")).toHaveText(expected[i].price);
      for (const link of await card.getByRole("link").all())
        await expect(link).toHaveAttribute("href", expected[i].href);
      const action = card.locator(".card-bottom a");
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const cardBox = (await card.boundingBox())!,
        actionBox = (await action.boundingBox())!;
      expect(actionBox.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      await expect(card.locator(".product-option-preview")).toBeVisible();
      await expect(card.locator(".product-size-preview")).toBeVisible();
    }
    await expect(cards.first().locator(".product-shipping-badge")).toHaveText("توصيل مجاني");
    await expect(cards.nth(1).locator(".product-shipping-badge")).toHaveCount(0);
    await expect(cards.last().locator(".quantity-card-hint")).toContainText("90.00 MAD");
    const row = await cards.evaluateAll((elements) =>
      elements.map((e) => ({
        x: e.getBoundingClientRect().x,
        y: Math.round(e.getBoundingClientRect().y),
        bottom: e.querySelector(".card-bottom a")!.getBoundingClientRect().bottom,
      })),
    );
    expect(new Set(row.map((e) => e.y)).size).toBe(width < 768 ? 2 : 1);
    for (const card of row) {
      const same = row.filter((e) => e.y === card.y);
      expect(
        Math.max(...same.map((e) => e.bottom)) - Math.min(...same.map((e) => e.bottom)),
      ).toBeLessThan(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    expect(writes).toEqual([]);
    await cards.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`home-products-${width}.png`) });
    await cards.nth(1).locator(".card-bottom a").click();
    await expect(page).toHaveURL(/\/products\/fixture-premium$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("موديل للمقارنة");
  });
}
