import { test, expect } from "@playwright/test";

const item = {
  productId: "222222222222222222222222",
  productSlug: "fixture-sabot",
  variantId: "333333333333333333333330",
  nameFr: "Sabot fictif",
  nameAr: "صابو تجريبي",
  nameEn: "Fixture clog",
  colorNameFr: "أسود",
  colorNameAr: "أسود",
  colorNameEn: "أسود",
  size: "40",
  price: 230,
  quantity: 1,
  stock: 2,
  image: "/images/catalogue-test/sac.webp",
  freeShipping: true,
};
for (const width of [390, 1440]) {
  test(`Saved basket refreshes current product names and persists them at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(
      (value) => {
        if (!localStorage.getItem("imad-store-cart"))
          localStorage.setItem(
            "imad-store-cart",
            JSON.stringify({ state: { items: [value] }, version: 0 }),
          );
      },
      { ...item, nameAr: "اسم قديم", nameFr: "Ancien nom", nameEn: "Old name" },
    );
    await page.goto("/shop?stats_test=1");
    const open = page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true }).first();
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".bag-line-name")).toHaveText(item.nameAr);
    await expect(dialog.locator(".bag-notice")).toContainText("تفاصيل المنتجات");
    await expect(dialog.locator(".bag-grand-total")).toContainText("230.00");
    await expect(dialog.locator(".bag-quantity span")).toHaveText("1");
    await expect(dialog.locator(".bag-line-name")).toHaveAttribute(
      "href",
      "/products/fixture-sabot",
    );
    await page.screenshot({ path: info.outputPath(`basket-current-details-${width}.png`) });
    await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
    await page.reload();
    await open.click();
    await expect(dialog.locator(".bag-line-name")).toHaveText(item.nameAr);
    await expect(dialog.locator(".bag-review-status")).toContainText("محدثان");
    await expect(dialog.locator(".bag-notice")).toHaveCount(0);
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("imad-store-cart")!).state.items[0],
    );
    expect([saved.nameAr, saved.nameFr, saved.nameEn, saved.variantId, saved.quantity]).toEqual([
      item.nameAr,
      item.nameFr,
      item.nameEn,
      item.variantId,
      1,
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  for (const direct of [false, true])
    test(`Checkout reviews an Arabic variant change (${direct ? "direct" : "service"}) at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(
        (value) =>
          localStorage.setItem(
            "imad-store-cart",
            JSON.stringify({ state: { items: [value] }, version: 0 }),
          ),
        item,
      );
      let renamed = false,
        reads = 0;
      const orders: unknown[] = [];
      if (direct)
        await page.route("**/api/settings", async (route) => {
          const response = await route.fetch();
          const body = await response.json();
          body.data.directSiteConfirmation = true;
          await route.fulfill({ response, json: body });
        });
      await page.route("**/api/products/fixture-sabot", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (renamed)
          body.data.variants = body.data.variants.map((v: { id: string }) =>
            v.id === item.variantId ? { ...v, colorNameAr: "أسود محدث" } : v,
          );
        await route.fulfill({ response, json: body });
        reads++;
      });
      await page.route("**/api/orders", (route) => {
        orders.push(route.request().postDataJSON());
        return route.abort("failed");
      });
      await page.goto("/checkout?stats_test=1");
      await expect.poll(() => reads).toBeGreaterThan(0);
      await page
        .getByRole("textbox", { name: "الاسم الكامل", exact: true })
        .fill("اختبار واجهة فقط");
      await page.getByRole("textbox", { name: "رقم الهاتف", exact: true }).fill("0600000099");
      await page.locator("#checkout-city").selectOption("tangier");
      await page
        .getByRole("textbox", { name: "عنوان التوصيل", exact: true })
        .fill("Rue fictive de test 1");
      const review = page.getByRole("region", { name: "راجعوا طلبكم قبل التأكيد النهائي" });
      if (direct) {
        await page.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
        await expect(review).toBeVisible();
        expect(orders).toHaveLength(0);
      }
      renamed = true;
      const submit = page.getByRole("button", {
        name: direct ? "أؤكد طلبي" : "تأكيد الطلب",
        exact: true,
      });
      await submit.click();
      const notice = page.locator(".checkout-submission-error");
      await expect(notice).toContainText("تغيرت تفاصيل المنتجات");
      await expect(notice).toBeFocused();
      expect(orders).toHaveLength(0);
      await expect(page.locator(".checkout-items-disclosure .bag-line-variant")).toContainText(
        "أسود محدث",
      );
      await expect(page.getByRole("textbox", { name: "الاسم الكامل", exact: true })).toHaveValue(
        "اختبار واجهة فقط",
      );
      await page.screenshot({ path: info.outputPath(`checkout-detail-review-${width}.png`) });
      if (direct) {
        await expect(review).toHaveCount(0);
        await page.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
        await expect(review).toContainText("أسود محدث");
        expect(orders).toHaveLength(0);
      }
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect.poll(() => orders.length).toBe(1);
      expect((orders[0] as { items: unknown }).items).toEqual([
        { productId: item.productId, variantId: item.variantId, quantity: 1 },
      ]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
}
