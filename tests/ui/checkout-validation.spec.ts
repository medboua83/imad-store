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

for (const width of [320, 390, 1440]) {
  test(`Checkout errors clear when fields are corrected without another submission at ${width}px`, async ({
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
    let orders = 0;
    await page.route("**/api/orders", (route) => {
      orders++;
      return route.abort("failed");
    });
    await page.goto("/checkout?stats_test=1");
    const name = page.getByRole("textbox", { name: "الاسم الكامل", exact: true });
    const phone = page.getByRole("textbox", { name: "رقم الهاتف", exact: true });
    const city = page.locator("#checkout-city");
    const address = page.getByRole("textbox", { name: "عنوان التوصيل", exact: true });
    const submit = page.getByRole("button", { name: "تأكيد الطلب", exact: true });
    await expect(page.locator(".checkout-field-error")).toHaveCount(0);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator(".checkout-field-error")).toHaveCount(4);
    await expect(name).toBeFocused();
    expect(orders).toBe(0);
    await name.fill("Ab");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await name.fill("Client fictif");
    await expect(name).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("#fullName-error")).toHaveCount(0);
    await phone.fill("0600000000");
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await phone.fill("06 00 00 00 99");
    await expect(phone).toHaveAttribute("aria-invalid", "false");
    await expect(phone).toHaveAttribute("aria-describedby", "phone-hint");
    await page.locator("#checkout-city-search").fill("طنجة");
    await expect(city).toHaveAttribute("aria-invalid", "true");
    await city.selectOption("tangier");
    await expect(city).toHaveAttribute("aria-invalid", "false");
    await address.fill("abcd");
    await expect(address).toHaveAttribute("aria-invalid", "true");
    await address.fill("Adresse fictive de test 1");
    await expect(address).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator(".checkout-field-error")).toHaveCount(0);
    expect(orders).toBe(0);
    await name.fill("");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await name.press("Enter");
    await expect(name).toBeFocused();
    expect(orders).toBe(0);
    await page.screenshot({ path: info.outputPath(`validation-rechecked-${width}.png`) });
    await name.fill("Client fictif");
    await expect(page.locator(".checkout-field-error")).toHaveCount(0);
    await submit.click();
    await expect.poll(() => orders).toBe(1);
    await expect(name).toHaveValue("Client fictif");
    await expect(phone).toHaveValue("06 00 00 00 99");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
