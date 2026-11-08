import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, options: { arabic?: boolean; conflict?: boolean } = {}) {
    const writes: Record<string, string>[] = [];
    const categories: Record<string, string>[] = [];
    await page.addInitScript((arabic) => {
        localStorage.setItem("adminToken", "isolated-category-entry");
        localStorage.setItem("imad-admin-language", arabic ? "ar" : "fr");
    }, Boolean(options.arabic));
    await page.route("**/api/**", async (route) => {
        const req = route.request(),
            path = new URL(req.url()).pathname;
        if (path === "/api/categories" && req.method() === "POST") {
            const body = req.postDataJSON();
            writes.push(body);
            if (options.conflict && writes.length === 1)
                return route.fulfill({
                    status: 409,
                    json: { error: "Cet identifiant ou SKU existe déjà" },
                });
            categories.push({ id: "111111111111111111111112", ...body });
            return route.fulfill({ status: 201, json: { success: true, data: categories.at(-1) } });
        }
        if (req.method() !== "GET") return route.fulfill({ status: 405 });
        const data = path === "/api/categories" ? categories : [];
        return route.fulfill({ json: { success: true, data, total: 0, unread: 0 } });
    });
    await page.goto("/admin?tab=categories");
    const labels = options.arabic
        ? {
              nameFr: "الاسم الفرنسي",
              nameAr: "الاسم العربي",
              nameEn: "الاسم الإنجليزي",
              slug: "رابط الفئة",
              create: "إنشاء الفئة",
              success: "أُضيفت الفئة.",
          }
        : {
              nameFr: "Nom français",
              nameAr: "Nom arabe",
              nameEn: "Nom anglais",
              slug: "Adresse de la catégorie",
              create: "Créer la catégorie",
              success: "Catégorie ajoutée.",
          };
    const field = (key: "nameFr" | "nameAr" | "nameEn" | "slug") =>
        page.getByLabel(labels[key], { exact: true });
    await expect(field("nameFr")).toBeVisible();
    const create = page.getByRole("button", { name: labels.create, exact: true });
    async function names(english = "Long cashmere coat") {
        await field("nameFr").fill("  Manteau long en Cachemire  ");
        await field("nameAr").fill("معطف كشمير طويل");
        if (english) await field("nameEn").fill(english);
    }
    return { field, create, names, writes, categories, labels };
}

for (const width of [390, 1440]) {
    test(`The photographed uppercase category address creates one normalized category at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page);
        await f.names();
        await f.field("slug").fill("Manteau-categorie");
        await f.create.click();
        await expect.poll(() => f.writes.length).toBe(1);
        expect(f.writes[0].slug).toBe("manteau-categorie");
        expect(f.writes[0].nameFr).toBe("Manteau long en Cachemire");
        await expect(page.getByText(f.labels.success, { exact: true })).toBeVisible();
        await expect(page.locator(".admin-category-list strong")).toHaveText([
            "Manteau long en Cachemire",
        ]);
        await expect(f.field("nameFr")).toHaveValue("");
        expect(f.categories).toHaveLength(1);
    });

    test(`Category address generation keeps all three names required at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const arabic = width === 390;
        const f = await fixture(page, { arabic });
        await f.names("");
        await f.create.click();
        await expect(f.field("nameEn")).toBeFocused();
        expect(
            await f.field("nameEn").evaluate((el: HTMLInputElement) => el.validationMessage),
        ).toBe(arabic ? "أدخلوا الاسم بالإنجليزية." : "Renseignez le nom anglais.");
        expect(f.writes).toEqual([]);
        await f.field("nameEn").fill("Long cashmere coat");
        await f.field("slug").fill("معاطف");
        await f.create.click();
        await expect(
            page
                .getByRole("alert")
                .filter({ hasText: arabic ? "أحرف لاتينية" : "lettres latines" }),
        ).toBeVisible();
        expect(f.writes).toEqual([]);
        await f.field("slug").fill("");
        await expect(
            page.getByText("/shop?category=manteau-long-en-cachemire", { exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: info.outputPath(`category-generated-${width}.png`) });
        await f.create.click();
        await expect(page.getByText(f.labels.success, { exact: true })).toBeVisible();
        expect(f.writes).toHaveLength(1);
        expect(f.writes[0].slug).toBe("manteau-long-en-cachemire");
        expect(f.writes[0].nameEn).toBe("Long cashmere coat");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });

    test(`A conflicting category address keeps the entered names and permits a corrected retry at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page, { conflict: true });
        await f.names();
        await f.field("slug").fill("Manteau-categorie");
        await f.create.click();
        await expect(
            page.getByRole("alert").filter({ hasText: "Cette adresse est déjà utilisée" }),
        ).toBeVisible();
        await expect(f.field("nameFr")).toHaveValue("  Manteau long en Cachemire  ");
        await expect(f.field("nameAr")).toHaveValue("معطف كشمير طويل");
        await expect(f.field("nameEn")).toHaveValue("Long cashmere coat");
        expect(f.writes).toHaveLength(1);
        expect(f.categories).toHaveLength(0);
        await f.field("slug").fill("Manteau Été");
        await f.create.click();
        await expect(page.getByText(f.labels.success, { exact: true })).toBeVisible();
        expect(f.writes).toHaveLength(2);
        expect(f.writes[1].slug).toBe("manteau-ete");
        expect(f.categories).toHaveLength(1);
    });
}
