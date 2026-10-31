import { test, expect } from "@playwright/test";

const savedItem = {
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

for (const width of [390, 1440]) {
  test(`A temporary catalogue error refetches on retry and keeps filters at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(
      (item) =>
        localStorage.setItem(
          "imad-store-cart",
          JSON.stringify({ state: { items: [item] }, version: 0 }),
        ),
      savedItem,
    );
    const query = `search=retry-fixture-${width}&category=mens-clogs&sort=price-asc`;
    await page.goto(`/shop?${query}`);
    await expect(
      page.getByRole("heading", { name: "تعذر تحميل هذه الصفحة", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath(`temporary-error-${width}.png`) });
    await page.getByRole("button", { name: "إعادة المحاولة", exact: true }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "تعذر تحميل هذه الصفحة", exact: true }),
    ).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("search")).toBe(`retry-fixture-${width}`);
    expect(new URL(page.url()).searchParams.get("category")).toBe("mens-clogs");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("price-asc");
    await page.screenshot({ path: info.outputPath(`recovered-catalogue-${width}.png`) });
    await page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true }).first().click();
    await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("230.00");
    await expect(page.getByRole("dialog").locator(".bag-quantity span")).toHaveText("1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`A persistent outage can be retried again or left safely at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/shop?search=outage-fixture");
    const retry = page.getByRole("button", { name: "إعادة المحاولة", exact: true });
    await expect(retry).toBeVisible();
    for (let attempt = 0; attempt < 2; attempt++) {
      await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === "/shop" && url.searchParams.get("search") === "outage-fixture";
        }),
        retry.click(),
      ]);
      await expect(retry).toBeEnabled();
      await expect(
        page.getByRole("heading", { name: "تعذر تحميل هذه الصفحة", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".catalog-card, .shop-empty-state")).toHaveCount(0);
    }
    const error = page.locator(".store-page-error");
    await expect(error.getByRole("link", { name: "تواصلوا معنا", exact: true })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`persistent-error-${width}.png`) });
    await error.getByRole("link", { name: "عرض كل المنتجات", exact: true }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(1);
    await expect(error).toHaveCount(0);
  });
}
