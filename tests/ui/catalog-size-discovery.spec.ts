import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`Available size filter carries the choice to the matching color at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop?filters=open&search=size-fixture&category=mens-clogs&sort=price-asc");
    const size = page.getByRole("combobox", { name: "المقاس", exact: true });
    await expect(size.locator("option")).toHaveText(["جميع المقاسات", "40", "44", "M"]);
    await size.selectOption("44");
    await page.screenshot({ path: info.outputPath(`size-filter-${width}.png`) });
    await page.getByRole("button", { name: "عرض النتائج", exact: true }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(1);
    await expect(page.locator(".product-option-preview")).toContainText("بني");
    await expect(page.locator(".product-option-preview")).not.toContainText("أسود");
    await expect(page.locator(".product-size-preview")).toContainText("44");
    await expect(page.locator(".product-size-preview")).not.toContainText("40");
    await expect(page).toHaveURL(url => url.searchParams.get("size") === "44");
    const query = new URL(page.url()).searchParams;
    expect(query.get("size")).toBe("44");
    expect(query.get("search")).toBe("size-fixture");
    expect(query.get("category")).toBe("mens-clogs");
    expect(query.get("sort")).toBe("price-asc");
    await expect(page.locator(".active-filter-chips")).toContainText("المقاس: 44");
    for (const href of await page
      .locator(".catalog-card a")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href"))))
      expect(new URL(href!, page.url()).searchParams.get("size")).toBe("44");
    await page.locator(".catalog-card .text-link").click();
    await expect(page.getByRole("button", { name: "44", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "بني", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "أسود", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const canonical = new URL("/products/fixture-sabot", page.url()).href;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical);
    await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
    await expect(page.locator(".purchase-price")).toContainText("460.00");
    await page.screenshot({ path: info.outputPath(`size-selected-${width}.png`) });
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    const cart = page.locator(".cart-dialog");
    await expect(cart).toContainText("بني · 44");
    await expect(cart.locator(".bag-quantity span")).toHaveText("2");
    await expect(cart.locator(".bag-grand-total")).toContainText("460.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Unavailable sizes require an explicit new choice and filters survive recovery at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop?search=size-race&size=40");
    await page.locator(".catalog-card .text-link").click();
    await expect(page.getByRole("status", { name: "المقاس المطلوب", exact: true })).toContainText(
      "غير متوفر",
    );
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`size-unavailable-${width}.png`) });
    await page.getByRole("link", { name: "عرض المقاسات الأخرى", exact: true }).click();
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "44", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.goto("/products/fixture-sabot?size=99");
    await expect(page.getByRole("status", { name: "المقاس المطلوب", exact: true })).toContainText(
      "غير متوفر",
    );
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toHaveCount(0);
    await page.goto("/shop?filters=open&search=size-no-options&category=mens-clogs&size=44");
    await expect(page.getByRole("textbox", { name: "المقاس", exact: true })).toHaveValue("44");
    await expect(page.locator(".catalog-card")).toHaveCount(1);
    await page.getByRole("link", { name: "إزالة الفلتر: المقاس: 44", exact: true }).click();
    await expect(page).toHaveURL(url => !url.searchParams.has("size"));
    expect(new URL(page.url()).searchParams.get("size")).toBeNull();
    expect(new URL(page.url()).searchParams.get("category")).toBe("mens-clogs");
    expect(new URL(page.url()).searchParams.get("search")).toBe("size-no-options");
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await page.goto("/shop?search=page-fixture&size=44&page=99");
    await page.getByRole("link", { name: "العودة إلى أول صفحة", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("size")).toBe("44");
    await page.getByRole("link", { name: "الصفحة التالية", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("size")).toBe("44");
    await expect(page.locator(".shop-pagination")).toContainText("2 / 3");
    await page.goto("/shop?size=40&size=44");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("صححوا الفلاتر");
    await expect(page.locator(".catalog-card")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
