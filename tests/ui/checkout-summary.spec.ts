import { test, expect, type Page } from "@playwright/test";

async function prepare(page: Page) {
  let orders = 0;
  await page.route("**/api/orders", route => { orders++; return route.abort(); });
  await page.goto("/products/fixture-manual");
  await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
  await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("400.00");
  await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
  await page.goto("/checkout");
  return () => orders;
}

for (const viewport of [{width:320,height:740}, {width:390,height:844}, {width:1440,height:900}]) {
  test(`Order summary stays editable and the first field is reachable at ${viewport.width}px`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const orders = await prepare(page);
    const disclosure = page.locator(".checkout-order-disclosure");
    const toggle = disclosure.locator(":scope > summary");
    if (viewport.width < 768) {
      await expect(disclosure).not.toHaveAttribute("open");
      await expect(page.locator(".checkout-compact-total")).toContainText("400.00");
      const input = await page.getByLabel("الاسم الكامل").boundingBox();
      expect(input!.y + input!.height).toBeLessThan(viewport.height - 80);
      await page.screenshot({path:info.outputPath(`checkout-compact-${viewport.width}.png`)});
      await toggle.focus();
      await toggle.press("Enter");
    }
    await expect(disclosure).toHaveAttribute("open");
    await expect(disclosure.locator(".bag-grand-total")).toBeVisible();
    await expect(disclosure.locator(".bag-grand-total")).toContainText("400.00");
    await page.getByText("عرض وتعديل المنتجات", {exact:true}).click();
    await disclosure.getByRole("button", {name:"تقليل كمية صابو تجريبي",exact:true}).click();
    await expect(disclosure.locator(".bag-grand-total")).toContainText("230.00");
    await toggle.click();
    await expect(page.locator(".checkout-compact-total")).toContainText("230.00");
    await page.reload();
    if (viewport.width < 768) await expect(page.locator(".checkout-compact-total")).toContainText("230.00");
    else await expect(disclosure).toHaveAttribute("open");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(orders()).toBe(0);
    expect(errors).toEqual([]);
    if (viewport.width >= 768) await page.screenshot({path:info.outputPath("checkout-desktop.png")});
  });
}

test("A compact summary never advertises a total when delivery settings fail", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const orders = await prepare(page);
  await page.route("**/api/settings", route => route.abort());
  await page.reload();
  await expect(page.locator(".checkout-compact-total")).toContainText("بانتظار رسوم التوصيل");
  await expect(page.locator(".checkout-compact-total")).not.toContainText("400.00");
  await expect(page.getByRole("button", {name:"تأكيد الطلب",exact:true})).toBeDisabled();
  expect(orders()).toBe(0);
});
