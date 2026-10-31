import { test, expect, type Page } from "@playwright/test";

async function expectUnobscuredQuestions(page: Page) {
  await expect(page.locator("#questions")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const heading = document
          .querySelector("#shopping-questions-title")!
          .getBoundingClientRect();
        const firstQuestion = document.querySelector("#questions summary")!.getBoundingClientRect();
        const header = document.querySelector("header")!.getBoundingClientRect();
        return heading.top >= header.bottom + 8 && firstQuestion.bottom < innerHeight;
      }),
    )
    .toBe(true);
}

for (const width of [320, 390, 1440]) {
  test(`FAQ deep links and contact shortcuts remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const scrollWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("missing-data-scroll-behavior"))
        scrollWarnings.push(message.text());
    });
    await page.goto("/contact?stats_test=1#questions");
    await expectUnobscuredQuestions(page);
    const question = page.locator("#questions summary").first();
    await question.focus();
    await question.press("Enter");
    await expect(page.locator("#questions details").first()).toHaveAttribute("open", "");
    await expect(page.locator("#questions details").first().locator("p")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`questions-visible-${width}.png`) });

    await page.goto("/contact?stats_test=1");
    const help = page.getByRole("navigation", { name: "مساعدة سريعة" });
    await help.getByRole("link", { name: /التوصيل والدفع/ }).click();
    await expect(page).toHaveURL(/\/delivery$/);
    await expect(page.locator("h1")).toHaveText("التوصيل والدفع");
    await page.getByRole("main").getByRole("link", { name: "تواصلوا معنا", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const title = document.querySelector("h1")!.getBoundingClientRect();
          return (
            title.top >= document.querySelector("header")!.getBoundingClientRect().bottom &&
            title.bottom < innerHeight
          );
        }),
      )
      .toBe(true);
    await help.getByRole("link", { name: /الاستبدال والإرجاع/ }).click();
    await expect(page).toHaveURL(/\/returns$/);
    await expect(page.locator("h1")).toHaveText("الاستبدال والإرجاع");
    await page.getByRole("main").getByRole("link", { name: "تواصلوا معنا", exact: true }).click();
    const whatsapp = page.locator(".contact-whatsapp");
    await expect(whatsapp).toHaveAttribute("href", "https://wa.me/message/M44N6KT35MW4N1");
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAccessibleName(/نافذة جديدة/);
    await page.screenshot({ path: info.outputPath(`contact-${width}.png`), fullPage: true });
    await help.getByRole("link", { name: /أسئلة قبل الطلب/ }).click();
    await expectUnobscuredQuestions(page);

    await page.goto("/shop?stats_test=1");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "أسئلة قبل الطلب", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact#questions$/);
    await expectUnobscuredQuestions(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    expect(scrollWarnings).toEqual([]);
  });
}
