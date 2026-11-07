import { test, expect, type Page } from "@playwright/test";

async function fixture(
    page: Page,
    options: { arabic?: boolean; delayed?: boolean; failOld?: boolean } = {},
) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    let finished = false,
        ended = false;
    const markEnded = (request: { url(): string }) => {
        if (new URL(request.url()).pathname === "/api/integrations/deskcomm/orders/A1111111")
            ended = true;
    };
    page.on("requestfinished", markEnded);
    page.on("requestfailed", markEnded);
    let state = "SENT";
    const reads: string[] = [],
        writes: string[] = [];
    await page.addInitScript((arabic) => {
        localStorage.setItem("adminToken", "isolated-crm-diagnostic");
        localStorage.setItem("imad-admin-language", arabic ? "ar" : "fr");
    }, Boolean(options.arabic));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            path = new URL(request.url()).pathname;
        if (request.method() !== "GET") {
            writes.push(request.method() + " " + path);
            return route.fulfill({ status: 405 });
        }
        if (path.startsWith("/api/integrations/deskcomm/orders/")) {
            const reference = path.split("/").at(-1)!;
            reads.push(reference);
            const old = options.delayed && reference === "A1111111";
            if (old) await gate;
            try {
                return await route.fulfill(
                    old && options.failOld
                        ? { status: 503, json: { error: "Ancienne erreur fictive" } }
                        : { json: { success: true, data: { reference, state, attempts: 2 } } },
                );
            } finally {
                if (old) finished = true;
            }
        }
        const data =
            path === "/api/integrations/deskcomm"
                ? { enabled: false, configured: false, updatedAt: null, connection: null }
                : path === "/api/settings"
                  ? {
                        shippingCost: 30,
                        freeShippingMin: 500,
                        codEnabled: true,
                        metaPixelEnabled: false,
                    }
                  : [];
        return route.fulfill({ json: { success: true, data, total: 0, unread: 0 } });
    });
    await page.goto("/admin?tab=deskcomm");
    const reference = page.getByLabel(options.arabic ? "مرجع الطلب" : "Référence de commande", {
        exact: true,
    });
    await expect(reference).toBeVisible();
    const form = page.locator(".admin-crm form").filter({ has: reference });
    const button = form.getByRole("button", {
        name: options.arabic ? "التحقق من الإرسال إلى CRM" : "Vérifier l’envoi CRM",
        exact: true,
    });
    return {
        reference,
        form,
        button,
        reads,
        writes,
        release,
        finished: () => finished && ended,
        setState: (value: string) => {
            state = value;
        },
    };
}

async function settledPaint(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
    );
}

for (const width of [390, 1440]) {
    test(`CRM delivery states follow the Arabic dashboard language at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page, { arabic: true });
        await f.reference.fill("A1111111");
        const states = [
            ["NO_EVENT", "لا يوجد إرسال مقرر إلى CRM"],
            ["PENDING", "في انتظار الإرسال"],
            ["PROCESSING", "جارٍ الإرسال"],
            ["SENT", "أُرسل إلى Webhook"],
            ["FAILED", "فشل بعد عدة محاولات"],
        ];
        for (const [state, label] of states) {
            f.setState(state);
            await f.button.click();
            await expect(f.form.getByRole("status")).toContainText(label);
            if (state === "SENT") {
                await f.form.getByRole("status").scrollIntoViewIfNeeded();
                await page.screenshot({ path: info.outputPath(`crm-status-ar-${width}.png`) });
            }
        }
        expect(f.reads).toHaveLength(5);
        expect(f.writes).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });

    test(`Editing a CRM reference discards its pending success at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page, { delayed: true });
        try {
            await f.reference.fill("A1111111");
            await f.button.click();
            await expect.poll(() => f.reads.length).toBe(1);
            await f.reference.fill("B2222222");
            f.release();
            await expect.poll(f.finished).toBe(true);
            await settledPaint(page);
            await expect(f.form.getByRole("status")).toHaveCount(0);
            await expect(f.button).toBeEnabled();
            await f.button.click();
            await expect(f.form.getByRole("status")).toContainText("#B2222222");
            await expect(f.form.getByRole("status")).not.toContainText("A1111111");
            expect(f.reads).toEqual(["A1111111", "B2222222"]);
            expect(f.writes).toEqual([]);
        } finally {
            f.release();
        }
    });

    test(`A late CRM failure cannot replace the next reference result at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page, { delayed: true, failOld: true });
        try {
            await f.reference.fill("A1111111");
            await f.button.click();
            await expect.poll(() => f.reads.length).toBe(1);
            await f.reference.fill("B2222222");
            await expect(f.button).toBeEnabled();
            await f.button.click();
            await expect(f.form.getByRole("status")).toContainText("#B2222222");
            f.release();
            await expect.poll(f.finished).toBe(true);
            await settledPaint(page);
            await expect(f.form.getByRole("status")).toContainText("#B2222222");
            await expect(f.form.getByRole("alert")).toHaveCount(0);
            expect(f.reads).toEqual(["A1111111", "B2222222"]);
            expect(f.writes).toEqual([]);
        } finally {
            f.release();
        }
    });
}
