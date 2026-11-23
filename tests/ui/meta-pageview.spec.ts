import { test, expect, type Page } from "@playwright/test";

const origin = "https://store.example.test";
const pixelId = "123456789";

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

// Model the SDK's independent history listener, including same-URL replaceState.
// No requests or test orders ever reach Meta or the live store.
const sdk = `(() => {
    const pixel = window.fbq;
    const queued = pixel.queue.slice();
    window.__pixelEvents = [];
    const send = (...args) => {
        if (args[0] === 'trackSingle')
            window.__pixelEvents.push({name: args[2], pixel: args[1], data: args[3], options: args[4], path: location.pathname});
    };
    pixel.callMethod = send;
    if (pixel.disablePushState !== true) {
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            history[method] = function (...args) {
                const result = original.apply(this, args);
                send('trackSingle', '${pixelId}', 'PageView');
                return result;
            };
        }
        addEventListener('popstate', () => send('trackSingle', '${pixelId}', 'PageView'));
    }
    queued.forEach(args => send(...args));
})();`;

async function fixture(page: Page) {
  await page.route(`${origin}/**`, async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace(origin, "http://127.0.0.1:3131"),
    });
    await route.fulfill({ response });
  });
  await page.route(`${origin}/api/settings`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          shippingCost: 45,
          freeShippingMin: 500,
          codEnabled: true,
          metaPixelEnabled: true,
          metaPixelId: pixelId,
          metaPixelMadPerUsd: 10,
        },
      },
    }),
  );
  await page.route("https://connect.facebook.net/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: sdk,
    }),
  );
  await page.route("https://www.facebook.com/**", (route) => route.abort());
}

async function events(page: Page, name: string) {
  return page.evaluate((event) => {
    const log =
      (
        window as unknown as {
          __pixelEvents?: {
            name: string;
            path: string;
            pixel: string;
            data?: unknown;
            options?: unknown;
          }[];
        }
      ).__pixelEvents || [];
    return log.filter((row) => row.name === event);
  }, name);
}

for (const width of [390, 1440]) {
  test(`One PageView per navigation, including history and repeated settings at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto(origin);
    await expect.poll(() => events(page, "PageView")).toHaveLength(1);
    await page.locator('a[href="/shop"]:visible').first().click();
    await expect(page).toHaveURL(`${origin}/shop`);
    await expect.poll(() => events(page, "PageView")).toHaveLength(2);
    await page.locator('a[href^="/products/fixture-sabot"]:visible').first().click();
    await expect.poll(() => events(page, "PageView")).toHaveLength(3);
    await expect.poll(() => events(page, "ViewContent")).toHaveLength(1);
    await page.goBack();
    await expect(page).toHaveURL(`${origin}/shop`);
    await expect.poll(() => events(page, "PageView")).toHaveLength(4);
    await page.goForward();
    await expect.poll(() => events(page, "PageView")).toHaveLength(5);
    await page.evaluate(() => {
      history.replaceState(history.state, "", location.href);
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.locator(".pixel-preference")).toBeVisible();
    await expect.poll(() => events(page, "PageView")).toHaveLength(5);
    expect((await events(page, "PageView")).map((e) => e.path)).toEqual([
      "/",
      "/shop",
      "/products/fixture-sabot",
      "/shop",
      "/products/fixture-sabot",
    ]);
    expect((await events(page, "PageView")).every((e) => e.pixel === pixelId)).toBe(true);
    await page.reload();
    await expect.poll(() => events(page, "PageView")).toHaveLength(1);
  });
}

test("Purchase keeps its value, event identity and deduplication after the navigation fix", async ({
  page,
}) => {
  await fixture(page);
  let orders = 0;
  const orderId = "aaaaaaaaaaaaaaaaaaaaaa91";
  await page.route(`${origin}/api/orders`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    expect(route.request().postDataJSON().expectedTotal).toBe(230);
    orders++;
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: orderId,
          status: "PENDING",
          paymentStatus: "PENDING",
          paymentMethod: "COD",
          totalAmount: 230,
          shippingCost: 0,
          customerName: "Client fictif",
          customerPhone: "+212600000099",
          city: "tangier",
          street: "Adresse fictive 1",
          createdAt: new Date().toISOString(),
          aiServiceConsent: false,
          items: [
            {
              id: "fixture-line",
              quantity: 1,
              unitPrice: 230,
              product: { nameFr: "Sabot fictif", nameAr: "صابو تجريبي", images: [] },
              variant: { colorNameAr: "أسود", size: "40", sku: "FIXTURE-40" },
            },
          ],
        },
      },
    });
  });
  await page.goto(`${origin}/products/fixture-sabot`);
  await expect.poll(() => events(page, "ViewContent")).toHaveLength(1);
  await page.getByRole("button", { name: "40", exact: true }).click();
  await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
  await page.getByRole("link", { name: "متابعة الطلب", exact: true }).click();
  await expect.poll(() => events(page, "InitiateCheckout")).toHaveLength(1);
  await page.locator("#checkout-fullName").fill("Client fictif");
  await page.locator("#checkout-phone").fill("0600000099");
  await page.locator("#checkout-city").fill("Tanger");
  await page.getByRole("option").first().click();
  await page.locator("#checkout-address").fill("Adresse fictive 1");
  await page.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
  await page.getByRole("button", { name: "أؤكد طلبي", exact: true }).click();
  await expect.poll(() => events(page, "Purchase")).toHaveLength(1);
  expect(orders).toBe(1);
  const purchase = (await events(page, "Purchase"))[0];
    expect(purchase.data).toEqual({ currency: "USD", value: 23 });
  expect(purchase.options).toEqual({ eventID: `order-${orderId}` });
  await page.reload();
  await expect.poll(() => events(page, "PageView")).toHaveLength(1);
  expect(await events(page, "Purchase")).toHaveLength(0);
  expect(orders).toBe(1);
});

test("Excluded test visits never load the advertising SDK", async ({ page }) => {
  await fixture(page);
  let scripts = 0;
  page.on("request", (request) => {
    if (request.url().includes("connect.facebook.net")) scripts++;
  });
  await page.goto(`${origin}/shop?stats_test=1`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(scripts).toBe(0);
  expect(await events(page, "PageView")).toHaveLength(0);
});
