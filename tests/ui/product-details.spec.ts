import { test, expect } from "@playwright/test";
for (const width of [390, 1440])
  test(`Product size, colour, photos and persisted cart at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/products/fixture-sabot");
    await expect(page.getByRole("heading", { name: "صابو تجريبي", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "40 41 42 43 44", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "44 — غير متوفر لهذا اللون", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "بني", exact: true }).click();
    await expect(page.getByRole("button", { name: "44", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "40 — غير متوفر لهذا اللون", exact: true }),
    ).toBeDisabled();
    await page.getByText("كيف تختارون المقاس المناسب؟", { exact: true }).click();
    await expect(page.getByText(/قيسوا طول القدم/)).toBeVisible();
    expect(await page.locator(".product-description").innerText()).toContain("اللون والمقاس");
    const structured = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(structured!).description).toContain("اللون والمقاس");
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("بني · 44");
    await expect(page.getByRole("dialog")).toContainText("الأسعار والتوفر محدثان");
    await expect(page.getByRole("dialog")).toContainText("230.00");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("بني · 44");
    await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`product-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
test("Delivery and returns show configured fees and never invent missing deadlines", async ({
  page,
}) => {
  await page.goto("/delivery");
  await expect(page.locator(".policy-page")).toContainText("45.00 MAD");
  await expect(page.locator(".policy-page")).toContainText("500.00 MAD");
  await expect(page.locator(".policy-page")).toContainText("لم يُنشر أجل توصيل محدد بعد");
  await page.goto("/returns");
  await expect(page.locator(".policy-steps li")).toHaveCount(3);
  await expect(page.locator(".policy-page")).toContainText("لم تُنشر بعد مدة");
});
