import { test, expect } from "@playwright/test";
for (const width of [390, 1280])
  test(`Olivraison config saves safely and displays tracking at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let saved: any;
    const cfg = {
      saved: false,
      enabled: false,
      autoPickup: true,
      configured: false,
      activatedAt: null,
      pickupAddress: {
        company: "Test",
        streetAddress: "Adresse fictive",
        city: "Rabat",
        phone: "+212600000099",
      },
      cityMapping: {},
    };
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-fixture"));
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      let data: any = [];
      if (path === "/api/integrations/olivraison") {
        if (req.method() === "PUT") {
          saved = req.postDataJSON();
          Object.assign(cfg, saved, { configured: true, saved: true });
          delete (cfg as any).apiKey;
          delete (cfg as any).secretKey;
        }
        if (req.method() === "DELETE")
          Object.assign(cfg, {
            saved: false,
            configured: false,
            enabled: false,
            autoPickup: true,
            cityMapping: {},
            pickupAddress: { company: "", streetAddress: "", city: "", phone: "" },
          });
        data = cfg;
      } else if (path === "/api/integrations/olivraison/shipments")
        data = [
          {
            id: "111111111111111111111111",
            trackingId: "OL-TEST",
            carrierStatus: "PICKUP",
            state: "ACTIVE",
            slipUrl: "https://partners.olivraison.com/slip.pdf",
            stickerUrl: "https://partners.olivraison.com/sticker.pdf",
          },
        ];
      else if (path === "/api/integrations/olivraison/test") data = [{ name: "Rabat", price: 30 }];
      else if (path === "/api/settings")
        data = { shippingCost: 30, freeShippingMin: 500, directSiteConfirmation: false };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data, total: 0, unread: 0 }),
      });
    });
    await page.goto("/admin");
    if (width < 768) await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("button", { name: "Paramètres", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "Automatiser Olivraison" });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await page.getByLabel("Clé API", { exact: true }).fill("test-api");
    await page.getByLabel("Clé secrète", { exact: true }).fill("test-secret");
    await page.getByRole("button", { name: "Enregistrer Olivraison", exact: true }).click();
    await expect(page.getByText("Configuration Olivraison enregistrée.")).toBeVisible();
    expect(saved.enabled).toBe(true);
    expect(saved.autoPickup).toBe(true);
    await expect(page.getByLabel("Clé API", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await expect(page.getByLabel("Entreprise", { exact: true })).toHaveValue("Test");
    await expect(page.getByLabel("Clé API", { exact: true })).toHaveValue("");
    await page.getByRole("button", { name: "Tester la connexion et charger les villes" }).click();
    await expect(page.getByText("Connexion réussie. Aucun colis créé.")).toBeVisible();
    await expect(page.getByText("Suivi : OL-TEST")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Bordereau de ramassage", exact: true }),
    ).toHaveAttribute("href", "https://partners.olivraison.com/slip.pdf");
    await page.reload();
    if (width < 768) await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("button", { name: "Paramètres", exact: true }).click();
    await expect(toggle).toHaveCount(0);
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.getByRole("button", { name: "Enregistrer Olivraison", exact: true }).click();
    await expect(page.getByText("Configuration Olivraison enregistrée.")).toBeVisible();
    expect(saved.enabled).toBe(false);
    await expect(toggle).toHaveCount(0);
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByRole("button", { name: "Modifier", exact: true })).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByText("Configuration Olivraison supprimée.")).toBeVisible();
    await expect(page.getByLabel("Entreprise", { exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: "Modifier", exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
