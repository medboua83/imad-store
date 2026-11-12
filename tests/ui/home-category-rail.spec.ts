import { test, expect, type Page } from "@playwright/test";

const root = (page: Page) => page.locator(".home-category-rail");
const nav = (page: Page) =>
  root(page).getByRole("navigation", { name: "فئات المتجر", exact: true });
const offset = (page: Page) => nav(page).evaluate((el) => Math.abs(el.scrollLeft));

for (const width of [320, 390, 1440]) {
  test(`Category photos keep their names below and sections stay distinct at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?stats_test=1");
    await root(page).scrollIntoViewIfNeeded();
    const links = nav(page).getByRole("link");
    await expect(links).toHaveCount(5);
    await expect(nav(page).locator('a[href*="empty-category"]')).toHaveCount(0);
    const boxes = await links.evaluateAll((elements) =>
      elements.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width };
      }),
    );
    if (width > 767) {
      expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
      for (const link of await links.all()) await expect(link).toBeInViewport({ ratio: 1 });
      await expect(root(page)).toHaveAttribute("data-rotation-state", "desktop");
      await expect(root(page).locator(".category-rail-controls")).toBeHidden();
    } else {
      const visible = await links.evaluateAll((elements) => {
        const r = elements[0].parentElement!.getBoundingClientRect();
        return elements.filter((e) => {
          const b = e.getBoundingClientRect();
          return b.left >= r.left - 1 && b.right <= r.right + 1;
        }).length;
      });
      expect(visible).toBe(3);
      await expect(root(page)).toHaveAttribute("data-rotation-state", "reduced-motion");
      await expect(root(page).getByRole("button", { name: /تنقل الفئات تلقائيًا/ })).toHaveCount(0);
    }
    for (const link of await links.all()) {
      const photo = (await link.locator(".collection-photo").boundingBox())!;
      const name = (await link.locator(".collection-name").boundingBox())!;
      expect(name.y).toBeGreaterThan(photo.y + photo.height);
      await expect(link.locator(".collection-photo")).toHaveCSS("aspect-ratio", "1 / 1");
      await expect(link.locator("img")).toHaveCSS("object-fit", "cover");
    }
    const sections = page.locator("#collections").getByRole("navigation", { name: "أقسام المتجر" });
    const buttons = sections.getByRole("link");
    await expect(buttons).toHaveCount(2);
    const first = (await buttons.nth(0).boundingBox())!,
      second = (await buttons.nth(1).boundingBox())!;
    expect(Math.abs(first.width - second.width)).toBeLessThan(1);
    for (const button of await buttons.all()) {
      await expect(button).not.toHaveAttribute("aria-current", "page");
      await expect(button).toHaveCSS("background-color", "rgb(48, 41, 31)");
      await expect(button).toHaveCSS("color", "rgb(255, 247, 230)");
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    await expect(page.locator("#collections .section-heading a")).toHaveAttribute("href", "/shop");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`categories-${width}.png`) });
  });
}

for (const direction of ["rtl", "ltr"]) {
  test(`Mobile categories advance gently and pause/resume without moving the page (${direction})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/?stats_test=1");
    await nav(page).evaluate((el, dir) => el.setAttribute("dir", dir), direction);
    await root(page).scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect(root(page)).toHaveAttribute("data-rotation-state", "playing");
    const y = await page.evaluate(() => scrollY);
    const step = await nav(page)
      .getByRole("link")
      .evaluateAll((items) =>
        Math.abs(items[1].getBoundingClientRect().x - items[0].getBoundingClientRect().x),
      );
    await page.clock.fastForward(6500);
    await expect.poll(async () => Math.abs((await offset(page)) - step)).toBeLessThan(2);
    expect(await page.evaluate(() => scrollY)).toBe(y);
    await root(page)
      .getByRole("button", { name: "إيقاف تنقل الفئات تلقائيًا", exact: true })
      .click();
    await expect(root(page)).toHaveAttribute("data-rotation-state", "paused");
    const stopped = await offset(page);
    await page.clock.fastForward(14000);
    expect(Math.abs((await offset(page)) - stopped)).toBeLessThan(2);
    await root(page)
      .getByRole("button", { name: "تشغيل تنقل الفئات تلقائيًا", exact: true })
      .click();
    await page.mouse.move(0, 0);
    await expect(root(page)).toHaveAttribute("data-rotation-state", "playing");
    await page.clock.fastForward(6500);
    await expect(
      root(page).getByRole("button", { name: "الفئات التالية", exact: true }),
    ).toBeDisabled();
    const edge = await offset(page);
    expect(edge).toBeGreaterThan(stopped + 20);
    await page.clock.fastForward(6500);
    await expect.poll(async () => Math.abs((await offset(page)) - step)).toBeLessThan(2);
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await expect(root(page)).toHaveAttribute("data-rotation-state", "offscreen");
    const off = await offset(page);
    await page.clock.fastForward(14000);
    expect(await offset(page)).toBe(off);
    await root(page).scrollIntoViewIfNeeded();
    await expect(root(page)).toHaveAttribute("data-rotation-state", "playing");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(root(page)).toHaveAttribute("data-rotation-state", "hidden-tab");
    const hidden = await offset(page);
    await page.clock.fastForward(14000);
    expect(await offset(page)).toBe(hidden);
    await page.evaluate(() => {
      delete (document as unknown as { hidden?: boolean }).hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(root(page)).toHaveAttribute("data-rotation-state", "playing");
    await page.keyboard.press("Tab");
    await nav(page).getByRole("link").first().focus();
    await expect(root(page)).toHaveAttribute("data-rotation-state", "paused");
  });
}

test.describe("Real touch interaction", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("Touch pauses, native horizontal swipe works and category links remain usable", async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/?stats_test=1");
    await root(page).scrollIntoViewIfNeeded();
    await expect(root(page)).toHaveAttribute("data-rotation-state", "playing");
    const box = (await nav(page).boundingBox())!;
    const client = await context.newCDPSession(page);
    const y = box.y + 30;
    const scroll = await page.evaluate(() => scrollY);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + 40, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + 170, y }],
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(root(page)).toHaveAttribute("data-rotation-state", "paused");
    await expect.poll(() => offset(page)).toBeGreaterThan(20);
    expect(Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThan(3);
    const moved = await offset(page);
    await root(page).getByRole("button", { name: "الفئات السابقة", exact: true }).tap();
    await expect.poll(() => offset(page)).toBeLessThan(moved - 10);
    await nav(page).getByRole("link", { name: "صابو رجالي", exact: true }).tap();
    await expect(page).toHaveURL(/\/shop\?category=mens-clogs$/);
  });
});
