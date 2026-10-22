import { test, expect } from "@playwright/test";
for (const width of [390, 1280])
  test(`AI is controlled by dashboard and persists at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const config = {
      enabled: true,
      configured: true,
      signedSending: true,
      orderAssistanceEnabled: false,
      updatedAt: null,
    };
    let writes = 0;
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-fixture"));
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      let data: any = [];
      if (path === "/api/integrations/deskcomm") {
        if (req.method() === "PUT") {
          Object.assign(config, req.postDataJSON());
          writes++;
        }
        data = config;
      }
      await route.fulfill({ json: { success: true, data, total: 0, unread: 0 } });
    });
    async function open() {
      await page.goto("/admin");
      if (width < 768) await page.getByRole("button", { name: "Navigation", exact: true }).click();
      await page.getByRole("button", { name: "Intégration CRM", exact: true }).click();
    }
    await open();
    const toggle = page.getByRole("switch", { name: "Activer l’assistance IA par WhatsApp" });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Configuration enregistrée", { exact: true })).toBeVisible();
    expect(writes).toBe(1);
    expect(config.orderAssistanceEnabled).toBe(true);
    await open();
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Configuration enregistrée", { exact: true })).toBeVisible();
    expect(config.orderAssistanceEnabled).toBe(false);
    expect(writes).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
