import { test, expect } from "@playwright/test";
import { defaultSiteContent } from "@imad-store/shared";

for (const width of [390, 768, 1024, 1440]) {
  test(`Hero preview keeps long merchandise copy, real promotion and available colors usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-showcase-preview"));
    const writes: string[] = [];
    const title = "عباية طويلة أنيقة بتفاصيل ناعمة للمناسبات والإطلالات اليومية";
    const colors = ["#000000", "#ffffff", "#702020", "نقشة", "#225522", "#113366"];
    const variants = colors.map((color, i) => ({
      id: `variant-${i}`,
      color,
      colorNameAr: `لون ${i + 1}`,
      size: "M",
      stock: 2,
      sku: `TEST-${i}`,
    }));
    const product = {
      id: "222222222222222222222222",
      slug: "showcase-fixture",
      nameAr: title,
      nameFr: "Article fictif",
      nameEn: "Fixture",
      descriptionAr: "وصف حقيقي محفوظ في بطاقة المنتج. ".repeat(30),
      descriptionFr: "",
      descriptionEn: "",
      price: 230,
      compareAtPrice: 280,
      images: ["/images/catalogue-test/abaya.webp"],
      status: "ACTIVE",
      variants: [
        ...variants,
        { ...variants[0], id: "duplicate-size", size: "L" },
        { ...variants[0], id: "sold-color", color: "#ff0000", colorNameAr: "لون نفد", stock: 0 },
        {
          ...variants[0],
          id: "ambiguous-size",
          color: "#ff00ff",
          colorNameAr: "مقاس غير صالح",
          size: "40 41 42",
        },
      ],
    };
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") {
        writes.push(path);
        return route.fulfill({ status: 405 });
      }
      const data =
        path === "/api/content/admin"
          ? {
              draft: defaultSiteContent,
              published: defaultSiteContent,
              revision: 0,
              canRollback: false,
            }
          : path === "/api/products" || path === "/api/products/admin/catalog"
            ? [product]
            : [];
      return route.fulfill({
        json: { success: true, data, total: Array.isArray(data) ? data.length : 0, unread: 0 },
      });
    });
    await page.goto("/admin?tab=content");
    await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode", exact: true });
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(hero.locator(".hero-product-price")).toContainText("230");
    await expect(hero.locator("del")).toContainText("280");
    await expect(hero.locator(".hero-color-swatch")).toHaveCount(4);
    await expect(hero.locator(".hero-colors-more")).toHaveText("+2");
    await expect(hero.getByRole("img", { name: "لون 4", exact: true })).toHaveText("لون 4");
    await expect(hero.getByRole("img", { name: "لون نفد", exact: true })).toHaveCount(0);
    await expect(hero.getByRole("img", { name: "مقاس غير صالح", exact: true })).toHaveCount(0);
    const cta = hero.getByRole("link", { name: "اكتشفوا هذا المنتج", exact: true });
    await expect(cta).toHaveAttribute("href", "/products/showcase-fixture");
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport({ ratio: 1 });
    expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await hero.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(hero.locator(".hero-photo")).toHaveCSS("object-fit", "contain");
    await expect(hero.locator(".hero-carousel-bar")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    if (width >= 768) {
      // A long title/description used to make the brown panel taller than the portrait.
      // The exposed beige strip must not return when a merchant changes the text.
      const frame = (await hero.locator(".editorial-hero").boundingBox())!;
      const visual = (await hero.locator(".hero-visual").boundingBox())!;
      expect(Math.abs(frame.y + frame.height - visual.y - visual.height)).toBeLessThan(1);
      const copy = hero.locator(".hero-copy");
      expect(await copy.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    }
    expect(writes).toEqual([]);
    await hero.screenshot({ path: info.outputPath(`showcase-long-${width}.png`) });
  });
}
