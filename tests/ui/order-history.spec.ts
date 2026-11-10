import { expect, test } from "@playwright/test";

test("Order history loads only when opened and displays a dated CRM confirmation", async ({ page }) => {
    const id = "777777777777777777777771";
    let historyReads = 0;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-history-fixture"));
    await page.route("**/api/**", async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== "GET") return route.fulfill({ status: 405 });
        if (path === `/api/orders/${id}/history`) {
            historyReads++;
            return route.fulfill({ json: { success: true, data: [{
                id: "confirmation", type: "status_changed", source: "crm",
                status: "CONFIRMED", createdAt: "2026-11-06T11:00:00Z",
            }] } });
        }
        const data = path === "/api/orders" ? [{
            id, customerName: "Client fictif", status: "CONFIRMED",
            paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 230,
            shippingCost: 0, createdAt: "2026-11-06T10:00:00Z", items: [],
        }] : [];
        await route.fulfill({ json: { success: true, data, total: data.length, page: 1, totalPages: 1, unread: 0 } });
    });
    await page.goto("/admin?tab=orders");
    await page.getByRole("button", { name: /Voir les détails/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(historyReads).toBe(0);
    await dialog.getByText("Historique de la commande", { exact: true }).click();
    const history = dialog.locator("details").filter({ hasText: "Historique de la commande" });
    await expect(history.getByText("Confirmée", { exact: true })).toBeVisible();
    await expect(history.getByText(/CRM/)).toBeVisible();
    await expect(history.locator("time")).toHaveAttribute("datetime", "2026-11-06T11:00:00Z");
    expect(historyReads).toBe(1);
});
