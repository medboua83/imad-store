import { test, expect, type Page } from "@playwright/test";

async function fixture(
    page: Page,
    options: { lagGlobal?: boolean; lagCategoryWrite?: boolean; lagProductRefresh?: boolean } = {},
) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const counts = { products: 0, categories: 0, orders: 0, notifications: 0 };
    const writes: string[] = [];
    let oldReadFinished = false;
    const category = {
        id: "111111111111111111111111",
        slug: "mens-clogs",
        nameFr: "Sabots",
        nameAr: "صابو",
        nameEn: "Clogs",
    };
    let categories = [category];
    let product = {
        id: "222222222222222222222222",
        slug: "fresh-fixture",
        nameFr: "Article initial",
        nameAr: "منتج تجريبي",
        nameEn: "Fixture item",
        descriptionFr: "",
        descriptionAr: "",
        descriptionEn: "",
        category,
        price: 230,
        status: "ACTIVE",
        images: ["/images/catalogue-test/sac.webp"],
        variants: [
            {
                id: "333333333333333333333333",
                sku: "READ-TEST",
                color: "#000000",
                colorNameFr: "Noir",
                colorNameAr: "أسود",
                colorNameEn: "Black",
                size: "40",
                stock: 5,
            },
        ],
    };
    let order = {
        id: "777777777777777777777771",
        customerName: "Client fictif",
        customerPhone: "+212600000099",
        city: "Rabat",
        address: "Adresse fictive",
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: "COD",
        totalAmount: 230,
        shippingCost: 0,
        createdAt: "2026-11-06T10:00:00Z",
        items: [],
    };
    let notification = {
        id: "notice-fixture",
        title: "Notification fictive",
        message: "Message de recette isolée",
        read: false,
        createdAt: "2026-11-06T10:00:00Z",
    };
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-read-freshness"));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            path = new URL(request.url()).pathname;
        if (path === "/api/auth/login" && request.method() === "POST") {
            product = { ...product, nameFr: "Article nouvelle session" };
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        accessToken: "new-isolated-reader",
                        refreshToken: "new-isolated-refresh",
                    },
                },
            });
        }
        if (request.method() !== "GET") {
            writes.push(request.method() + " " + path);
            if (path === "/api/products/" + product.id && request.method() === "PUT")
                product = { ...product, ...request.postDataJSON() };
            else if (path === "/api/categories" && request.method() === "POST") {
                if (options.lagCategoryWrite) await gate;
                categories = [
                    ...categories,
                    { ...request.postDataJSON(), id: "111111111111111111111112" },
                ];
            } else if (
                path === "/api/orders/" + order.id + "/status" &&
                request.method() === "PATCH"
            )
                order = { ...order, status: request.postDataJSON().status };
            else if (path === "/api/notifications/read-all" && request.method() === "POST")
                notification = { ...notification, read: true };
            else return route.fulfill({ status: 405 });
            return route.fulfill({ json: { success: true } });
        }
        let data: unknown = [];
        let unread = 0;
        if (path === "/api/products/admin/catalog") {
            if (new URL(request.url()).searchParams.get("limit") === "100") counts.products++;
            data = [product];
        }
        if (path === "/api/categories") {
            counts.categories++;
            data = categories;
        }
        if (path === "/api/orders") {
            counts.orders++;
            data = [order];
        }
        if (path === "/api/notifications") {
            counts.notifications++;
            data = [notification];
            unread = notification.read ? 0 : 1;
        }
        if (path === "/api/settings")
            data = {
                shippingCost: 30,
                freeShippingMin: 500,
                codEnabled: true,
                metaPixelEnabled: false,
            };
        // Capture the response before delaying it: this is an old server snapshot.
        const body = JSON.stringify({
            success: true,
            data,
            total: Array.isArray(data) ? data.length : 0,
            unread,
        });
        if (options.lagGlobal && path === "/api/notifications" && counts.notifications === 2)
            await gate;
        const oldProductRead =
            options.lagProductRefresh &&
            path === "/api/products/admin/catalog" &&
            new URL(request.url()).searchParams.get("limit") === "100" &&
            counts.products === 2;
        if (oldProductRead) await gate;
        await route.fulfill({ contentType: "application/json", body });
        if (oldProductRead) oldReadFinished = true;
    });
    return {
        release,
        counts,
        writes,
        oldReadFinished: () => oldReadFinished,
        changeProduct: () => {
            product = { ...product, nameFr: "Article actualisé" };
        },
    };
}
async function laggedRefresh(page: Page, counts: Record<string, number>) {
    await page.getByRole("button", { name: "Actualiser les données", exact: true }).click();
    await expect.poll(() => Object.values(counts).every((count) => count >= 2)).toBe(true);
}
async function categoryFields(page: Page) {
    await page.getByLabel("Adresse de la catégorie", { exact: true }).fill("nouveau-groupe");
    await page.getByLabel("Nom français", { exact: true }).fill("Groupe ajouté");
    await page.getByLabel("Nom arabe", { exact: true }).fill("مجموعة تجريبية");
    await page.getByLabel("Nom anglais", { exact: true }).fill("Fixture group");
}

for (const width of [390, 1440]) {
    test(`A late catalogue snapshot cannot undo a saved product on screen at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await fixture(page, { lagGlobal: true });
        await page.goto("/admin?tab=products");
        await page.getByRole("button", { name: "Modifier Article initial", exact: true }).click();
        await page.getByLabel("Nom français", { exact: true }).fill("Article enregistré");
        await laggedRefresh(page, mock.counts);
        try {
            await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
            await expect(
                page.getByRole("heading", { name: "Article enregistré", exact: true }),
            ).toBeVisible();
        } finally {
            mock.release();
        }
        await expect(
            page.getByRole("button", { name: "Actualiser les données", exact: true }),
        ).toBeEnabled();
        await expect(
            page.getByRole("heading", { name: "Article enregistré", exact: true }),
        ).toBeVisible();
        expect(mock.writes).toEqual(["PUT /api/products/222222222222222222222222"]);
    });

    test(`A late category snapshot cannot hide a successfully created category at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await fixture(page, { lagGlobal: true });
        await page.goto("/admin?tab=categories");
        await categoryFields(page);
        await laggedRefresh(page, mock.counts);
        try {
            await page.getByRole("button", { name: "Créer la catégorie", exact: true }).click();
            await expect(
                page.getByRole("button", { name: "Supprimer Groupe ajouté", exact: true }),
            ).toBeVisible();
        } finally {
            mock.release();
        }
        await expect(
            page.getByRole("button", { name: "Actualiser les données", exact: true }),
        ).toBeEnabled();
        await expect(
            page.getByRole("button", { name: "Supprimer Groupe ajouté", exact: true }),
        ).toBeVisible();
        expect(mock.writes).toEqual(["POST /api/categories"]);
    });

    test(`A late order snapshot cannot show a confirmed order as pending at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await fixture(page, { lagGlobal: true });
        await page.goto("/admin?tab=orders");
        await expect(page.getByRole("button", { name: "Confirmer", exact: true })).toBeVisible();
        await laggedRefresh(page, mock.counts);
        page.on("dialog", (dialog) => dialog.accept());
        try {
            await page.getByRole("button", { name: "Confirmer", exact: true }).click();
            await expect(page.getByRole("button", { name: "Confirmer", exact: true })).toHaveCount(
                0,
            );
        } finally {
            mock.release();
        }
        await expect(
            page.getByRole("button", { name: "Actualiser les données", exact: true }),
        ).toBeEnabled();
        await expect(page.getByRole("button", { name: "Confirmer", exact: true })).toHaveCount(0);
        await expect(page.getByText("Client fictif", { exact: true })).toBeVisible();
        expect(mock.writes).toEqual(["PATCH /api/orders/777777777777777777777771/status"]);
    });

    test(`A late notification snapshot cannot mark read messages unread again at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await fixture(page, { lagGlobal: true });
        await page.goto("/admin?tab=notifications");
        const mark = page.getByRole("button", { name: "Tout marquer comme lu", exact: true });
        await expect(mark).toBeEnabled();
        await laggedRefresh(page, mock.counts);
        try {
            await mark.click();
            await expect(mark).toBeDisabled();
        } finally {
            mock.release();
        }
        await expect(
            page.getByRole("button", { name: "Actualiser les données", exact: true }),
        ).toBeEnabled();
        await expect(mark).toBeDisabled();
        expect(mock.writes).toEqual(["POST /api/notifications/read-all"]);
    });

    test(`Category fields cannot accept text that would be lost during saving at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await fixture(page, { lagCategoryWrite: true });
        await page.goto("/admin?tab=categories");
        await categoryFields(page);
        await page.getByRole("button", { name: "Créer la catégorie", exact: true }).click();
        try {
            await expect.poll(() => mock.writes.length).toBe(1);
            for (const label of [
                "Adresse de la catégorie",
                "Nom français",
                "Nom arabe",
                "Nom anglais",
            ])
                await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
        } finally {
            mock.release();
        }
        await expect(page.getByText("Catégorie ajoutée.", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Nom français", { exact: true })).toBeEnabled();
        expect(mock.writes).toEqual(["POST /api/categories"]);
    });
}

test("A delayed manual refresh from an expired session cannot replace the next session's data", async ({
    page,
}) => {
    const mock = await fixture(page, { lagProductRefresh: true });
    await page.goto("/admin?tab=products");
    await expect(page.getByRole("heading", { name: "Article initial", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect.poll(() => mock.counts.products).toBe(2);
    await page.evaluate(() => window.dispatchEvent(new Event("imad:session-expired")));
    await page.getByLabel("Adresse e-mail", { exact: true }).fill("fixture@example.invalid");
    await page.getByLabel("Mot de passe", { exact: true }).fill("isolated-local-fixture");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    try {
        await expect(
            page.getByRole("heading", { name: "Article nouvelle session", exact: true }),
        ).toBeVisible();
    } finally {
        mock.release();
    }
    await expect.poll(mock.oldReadFinished).toBe(true);
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
    );
    await expect(
        page.getByRole("heading", { name: "Article nouvelle session", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Article initial", exact: true })).toHaveCount(
        0,
    );
    expect(mock.writes).toEqual([]);
});

test("Reloading an editor uses the newest applied catalogue when its own response is late", async ({
    page,
}) => {
    const mock = await fixture(page, { lagProductRefresh: true });
    await page.goto("/admin?tab=products");
    await page.getByRole("button", { name: "Modifier Article initial", exact: true }).click();
    await page.getByRole("button", { name: "Recharger cette fiche", exact: true }).click();
    await expect.poll(() => mock.counts.products).toBeGreaterThanOrEqual(2);
    mock.changeProduct();
    await page.getByRole("button", { name: "Actualiser les données", exact: true }).click();
    try {
        await expect(
            page.getByRole("heading", { name: "Article actualisé", exact: true }),
        ).toBeVisible();
    } finally {
        mock.release();
    }
    await expect.poll(mock.oldReadFinished).toBe(true);
    await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue("Article actualisé");
    expect(mock.writes).toEqual([]);
});
