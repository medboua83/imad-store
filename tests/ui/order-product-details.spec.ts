import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`Order details keep the purchased colour photo, SKU and amounts at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("adminToken", "isolated-order-details");
      localStorage.setItem("imad-admin-language", "fr");
    });
    let writes = 0;
    const item = {
      id: "line-fixture", quantity: 2, unitPrice: 100,
      product: { nameFr: "Abaya de recette", nameAr: "عباية تجريبية", images: ["/images/catalogue-test/sac.webp", "/images/catalogue-test/abaya.webp"], colorPhotos: [{colorKey: "#804000|marron", image: "/images/catalogue-test/abaya.webp"}] },
      variant: { color: "#804000", colorNameFr: "Marron", colorNameAr: "بني", colorNameEn: "Brown", size: "XL", sku: "AB-MARRON-XL" },
    };
    const order = { id: "666666666666666666666666", customerName: "Client fictif", customerPhone: "0600000099", city: "Rabat", status: "PENDING", paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 240, shippingCost: 40, createdAt: "2026-11-17T10:00:00Z", items: [item] };
    await page.route("**/api/**", route => {
      const req = route.request();
      if (req.method() !== "GET") { writes++; return route.fulfill({status: 405}); }
      const path = new URL(req.url()).pathname;
      const data = path === "/api/orders" ? [order] : [];
      return route.fulfill({json: {success: true, data, total: data.length, unread: 0}});
    });
    await page.goto(`/admin?tab=orders&order=${order.id}`);
    const lines = page.locator(".order-line-items");
    await expect(lines).toContainText("Couleur : Marron");
    await expect(lines).toContainText("Taille : XL");
    await expect(lines).toContainText("AB-MARRON-XL");
    const photo = lines.getByRole("img", {name: "Abaya de recette", exact: true});
    await expect(photo).toHaveAttribute("src", /abaya\.webp/);
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator(".order-totals")).toContainText("240,00");
    await expect(page.locator(".order-totals")).toContainText("40,00");
    await photo.scrollIntoViewIfNeeded();
    await page.screenshot({path: info.outputPath(`order-products-${width}.png`)});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(writes).toBe(0);
  });
}
