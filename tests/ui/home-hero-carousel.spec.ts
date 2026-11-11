import { test, expect } from "@playwright/test";
import { defaultSiteContent } from "@imad-store/shared";

for (const width of [320, 390, 1440]) {
  test(`Home hero switches product, original photo and link together at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width > 767 ? 1000 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?stats_test=1");
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
    const photo = hero.locator(".hero-photo");
    const link = hero.locator(".hero-product-link");
    await expect(photo).toHaveAttribute("src", /sac.webp/);
    await expect(link).toHaveAttribute("href", "/products/fixture-sabot");
    await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 3");
    const height = (await hero.boundingBox())!.height;
    // Controls are revealed by keyboard focus, never by pointer hover.
    const choose = async (number: number, direction: "next" | "previous" = "next") => {
      const control =
        width < 768
          ? hero.getByRole("button", { name: `عرض المنتج ${number} من 3`, exact: true })
          : hero.getByRole("button", {
              name: direction === "next" ? "المنتج التالي" : "المنتج السابق",
              exact: true,
            });
      await page.keyboard.press("Tab");
      await control.focus();
      await control.press("Space");
    };
    await choose(2);
    await expect(photo).toHaveAttribute("src", /abaya.webp/);
    await expect(link).toHaveAttribute("href", "/products/fixture-premium");
    await expect(hero.locator(".hero-product-price")).toContainText("300");
    await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
    expect(Math.abs((await hero.boundingBox())!.height - height)).toBeLessThan(2);
    await choose(3);
    await expect(link).toHaveAttribute("href", "/products/fixture-accessory");
    await choose(1);
    await expect(link).toHaveAttribute("href", "/products/fixture-sabot");
    await choose(3, "previous");
    await expect(link).toHaveAttribute("href", "/products/fixture-accessory");
    await expect(hero.locator("img")).toHaveCount(1);
    for (const button of await hero.getByRole("button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`carousel-${width}.png`) });
    await link.click();
    await expect(page).toHaveURL(/\/products\/fixture-accessory/);
  });
}

test("Automatic hero rotation pauses for hover, keyboard and explicit pause", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?stats_test=1");
  const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
  const count = hero.locator(".hero-slide-count");
  const summary = hero.locator(".hero-product-summary");
  await expect(
    hero.getByRole("button", { name: "إيقاف العرض التلقائي", exact: true }),
  ).toBeVisible();
  await expect(summary).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(7500);
  await expect(count).toHaveText("2 / 3");
  await hero.hover();
  await page.clock.fastForward(15000);
  await expect(count).toHaveText("2 / 3");
  await page.mouse.move(0, 0);
  await expect(summary).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(7500);
  await expect(count).toHaveText("3 / 3");
  await page.keyboard.press("Tab");
  await hero.locator(".hero-product-link").focus();
  await expect(hero).toHaveAttribute("data-rotation-state", "paused");
  await page.clock.fastForward(15000);
  await expect(count).toHaveText("3 / 3");
  const play = hero.getByRole("button", { name: "تشغيل العرض التلقائي", exact: true });
  await play.focus();
  await expect(play).toHaveCSS("opacity", "1");
  await play.press("Space");
  await page.mouse.move(0, 0);
  await expect(summary).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(7500);
  await expect(count).toHaveText("1 / 3");
  await hero.getByRole("button", { name: "إيقاف العرض التلقائي", exact: true }).press("Space");
  await page.clock.fastForward(15000);
  await expect(count).toHaveText("1 / 3");
  await expect(hero).toHaveAttribute("data-rotation-state", "paused");
});

test("An offscreen hero stops rotating and resumes when it is visible again", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?stats_test=1");
  const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
  const summary = hero.locator(".hero-product-summary");
  await expect(summary).toHaveAttribute("aria-live", "off");
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.clock.fastForward(100);
  await expect(summary).toHaveAttribute("aria-live", "polite");
  await page.clock.fastForward(15000);
  await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 3");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.clock.fastForward(100);
  await expect(summary).toHaveAttribute("aria-live", "off");
  await page.clock.fastForward(7500);
  await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
});

test("Reduced motion keeps the hero still with manual controls", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?stats_test=1");
  const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
  await page.clock.fastForward(22000);
  await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 3");
  await expect(hero.getByRole("button", { name: /العرض التلقائي/ })).toHaveCount(0);
  await page.keyboard.press("Tab");
  await hero.getByRole("button", { name: "عرض المنتج 2 من 3", exact: true }).focus();
  await hero.getByRole("button", { name: "عرض المنتج 2 من 3", exact: true }).press("Space");
  await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
});

for (const custom of [false, true]) {
  test(`Content preview preserves ${custom ? "a custom campaign image" : "an empty catalogue"} without autoplay`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-hero-preview"));
    await page.route("**/api/**", (route) => {
      if (route.request().method() !== "GET") return route.fulfill({ status: 405 });
      const path = new URL(route.request().url()).pathname;
      const content = {
        ...defaultSiteContent,
        ...(custom ? { heroImage: "/images/catalogue-test/chale.webp" } : {}),
      };
      return route.fulfill({
        json: {
          success: true,
          data:
            path === "/api/content/admin"
              ? {
                  draft: content,
                  published: content,
                  revision: 1,
                  canRollback: false,
                }
              : [],
          total: 0,
          unread: 0,
        },
      });
    });
    await page.goto("/admin?tab=content");
    await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode" });
    await expect(hero.locator(".hero-photo")).toHaveAttribute(
      "src",
      custom ? /chale.webp/ : /abaya.webp/,
    );
    await expect(hero.locator(".hero-product-link")).toHaveAttribute("href", "/shop");
    await expect(hero.locator(".hero-product-link")).toHaveAttribute("target", "_blank");
    await expect(hero.getByRole("button")).toHaveCount(0);
  });
}

for (const width of [320, 390, 1440]) {
  test(`Hero starts automatically with no visual controls, even on hover, at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/?stats_test=1");
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode", exact: true });
    await expect(hero).toHaveAttribute("data-rotation-state", "playing");
    await expect(hero.locator(".hero-carousel-controls")).toHaveCSS("clip-path", "inset(50%)");
    await hero.hover();
    await expect(hero.locator(".hero-carousel-controls")).toHaveCSS("clip-path", "inset(50%)");
    await expect(hero.locator(".hero-pause-toggle")).toHaveCSS("opacity", "0");
    await expect(hero.locator(".hero-image-arrows")).toHaveCSS("opacity", "0");
    await page.mouse.move(0, 0);
    await page.clock.fastForward(7500);
    await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
    await expect(hero.locator(".hero-product-link")).toHaveAttribute(
      "href",
      "/products/fixture-premium",
    );
    await page.screenshot({ path: info.outputPath(`automatic-clean-${width}.png`) });
  });
}
