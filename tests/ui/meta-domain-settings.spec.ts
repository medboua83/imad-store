import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
    test(`Meta domain setting edits independently, retries and clears at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-meta-domain"));
        let settings = { shippingCost: 30, freeShippingMin: 500, codEnabled: true,
            metaPixelEnabled: true, metaPixelId: "123456789", metaPixelMadPerUsd: 11,
            metaDomainVerification: null as string | null };
        let attempts = 0;
        const writes: unknown[] = [];
        await page.route("**/api/**", async route => {
            const request = route.request(), path = new URL(request.url()).pathname;
            if (path === "/api/settings") {
                if (request.method() === "PUT") {
                    const body = request.postDataJSON(); writes.push(body); attempts++;
                    if (attempts === 1) return route.fulfill({ status: 503, json: { error: "fixture failure" } });
                    settings = { ...settings, ...body };
                }
                return route.fulfill({ json: { success: true, data: settings } });
            }
            return route.fulfill({ json: { success: true, data: [], unread: 0, total: 0 } });
        });
        await page.goto("/admin?tab=commerce#meta-domain-settings");
        const section = page.locator("#meta-domain-settings");
        const field = section.getByLabel("Code ou balise fournie par Meta", { exact: true });
        await expect(field).toBeVisible();
        await field.fill("<script>alert(1)</script>");
        await section.getByRole("button", { name: "Enregistrer le code Meta", exact: true }).click();
        await expect(field).toHaveAttribute("aria-invalid", "true");
        expect(writes).toEqual([]);
        const code = "Fixture_Meta_Domain_1234567890";
        await field.fill(`<meta name="facebook-domain-verification" content="${code}" />`);
        await section.getByRole("button", { name: "Enregistrer le code Meta", exact: true }).click();
        await expect(section.getByRole("alert")).toContainText("Votre saisie est conservée");
        await expect(field).toHaveValue(/<meta /);
        await section.getByRole("button", { name: "Enregistrer le code Meta", exact: true }).click();
        await expect(section.getByText("Code Meta enregistré. La validation finale se fait dans Meta.")).toBeVisible();
        expect(writes).toEqual([{ metaDomainVerification: code }, { metaDomainVerification: code }]);
        await field.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`meta-domain-fr-${width}.png`) });
        await page.reload();
        await expect(field).toHaveValue(code);
        await field.fill("Other_Meta_Domain_1234567890");
        await section.getByRole("button", { name: "Enregistrer le code Meta", exact: true }).click();
        await expect(field).toHaveValue("Other_Meta_Domain_1234567890");
        await section.getByRole("button", { name: "Effacer la saisie", exact: true }).click();
        await section.getByRole("button", { name: "Enregistrer le code Meta", exact: true }).click();
        await expect(section.getByText("Code Meta enregistré. La validation finale se fait dans Meta.")).toBeVisible();
        expect(settings.metaDomainVerification).toBeNull();
        expect(settings.metaPixelId).toBe("123456789");
        expect(settings.metaPixelEnabled).toBe(true);
        expect(settings.shippingCost).toBe(30);
        await page.getByLabel("Langue de l’administration").selectOption("ar");
        await expect(section.getByRole("heading", { name: "التحقق من نطاق المتجر لدى Meta" })).toBeVisible();
        await expect(section.getByLabel("الرمز أو وسم التحقق المقدم من Meta", { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`meta-domain-ar-${width}.png`) });
    });
}

test("Verification is in server-rendered head, updates and disappears without browser JavaScript", async ({ request }) => {
    const configure = (value: string | null) => request.put("http://127.0.0.1:4000/__fixture/meta-domain", { data: { value } });
    const first = "Fixture_First_1234567890", second = "Fixture_Second_1234567890";
    try {
        for (const code of [first, second]) {
            expect((await configure(code)).ok()).toBe(true);
            for (const agent of ["Mozilla/5.0", "facebookexternalhit/1.1"]) {
                const response = await request.get("/?stats_test=1", { headers: { "User-Agent": agent } });
                expect(response.ok()).toBe(true);
                const html = await response.text(), head = html.split("</head>")[0];
                expect(head).toContain(`<meta name="facebook-domain-verification" content="${code}"`);
                expect((head.match(/<meta name="facebook-domain-verification"/g) || []).length).toBe(1);
                if (code === second) expect(head).not.toContain(first);
            }
        }
        await configure(null);
        expect((await (await request.get("/")).text()).split("</head>")[0]).not.toContain('name="facebook-domain-verification"');
        await configure('<script>alert(1)</script>');
        const head = (await (await request.get("/")).text()).split("</head>")[0];
        expect(head).not.toContain('name="facebook-domain-verification"');
        expect(head).not.toContain('<script>alert(1)</script>');
    } finally { await configure(null); }
});
