import type { Page } from "@playwright/test";
export const actor = "123456789012345678901234",
  v1 = "333333333333333333333331",
  v2 = "333333333333333333333332",
  pid = "222222222222222222222222";
const token = (permissions = ["pos.sell"], role = "STAFF") =>
  "fixture." +
  Buffer.from(JSON.stringify({ id: actor, role, permissions })).toString("base64url") +
  ".fixture";
export async function fixture(page: Page, permissions = ["pos.sell"], locale = "fr") {
  const calls: { path: string; method: string; body: any; key: string | undefined; url: string }[] =
      [],
    receipts = new Map<string, any>();
  const state = {
    networkAfterCommit: false,
    failPrice: false,
    delay: 0,
    scanDelay: 0,
    historyFailure: false,
    historyDelay: 0,
  };
  const variants = [
    {
      id: v1,
      productId: pid,
      sku: "TEST-NOIR-M",
      nameFr: "Abaya test",
      nameAr: "عباية تجريبية",
      size: "M",
      colorFr: "Noir",
      colorAr: "أسود",
      stock: 5,
      available: true,
      unitPriceCents: 23000,
      image: "/images/catalogue-test/abaya.webp",
    },
    {
      id: v2,
      productId: pid,
      sku: "TEST-MARRON-L",
      nameFr: "Abaya test",
      nameAr: "عباية تجريبية",
      size: "L",
      colorFr: "Marron",
      colorAr: "بني",
      stock: 0,
      available: false,
      unitPriceCents: 23000,
      image: "/images/catalogue-test/abaya.webp",
    },
  ];
  await page.addInitScript(
    ({ token, locale }) => {
      localStorage.setItem("adminToken", token);
      localStorage.setItem("imad-admin-language", locale);
    },
    { token: token(permissions), locale },
  );
  const quote = (items: any[]) => {
    const lines = items.map((i) => {
      const v = variants.find((v) => v.id === i.variantId)!;
      return {
        ...i,
        productId: pid,
        sku: v.sku,
        nameFr: v.nameFr,
        nameAr: v.nameAr,
        colorFr: v.colorFr,
        colorAr: v.colorAr,
        size: v.size,
        unitPriceCents: 23000,
        totalCents: Math.floor(i.quantity / 2) * 40000 + (i.quantity % 2) * 23000,
      };
    });
    const totalCents = lines.reduce((s, i) => s + i.totalCents, 0);
    return {
      currency: "MAD",
      quoteHash: "a".repeat(64),
      lines,
      totalCents,
      savingsCents: items.reduce((s, i) => s + i.quantity * 23000, 0) - totalCents,
    };
  };
  await page.context().route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method(),
      body = method === "GET" ? null : req.postDataJSON(),
      key = req.headers()["idempotency-key"];
    calls.push({ path, method, body, key, url: url.toString() });
    if (path === "/api/pos/cash-sessions/context")
      return route.fulfill({ json: { success: true, data: { enabled: false, active: null } } });
    if (path === "/api/pos/context")
      return route.fulfill({
        json: {
          success: true,
          data: {
            actorId: actor,
            canSell: permissions.includes("pos.sell"),
            canReadAll: permissions.includes("pos.read"),
          },
        },
      });
    if (path === "/api/pos/scan") {
      if (state.scanDelay) await new Promise((r) => setTimeout(r, state.scanDelay));
      const data = variants.find((v) => v.sku === url.searchParams.get("sku"));
      try {
        return await route.fulfill({
          status: data ? 200 : 404,
          json: data ? { success: true, data } : { error: "Référence introuvable." },
        });
      } catch {
        return;
      }
    }
    if (path === "/api/pos/catalog") {
      const s = url.searchParams.get("search")?.toLowerCase();
      const data = s
        ? variants.filter((v) =>
            [v.sku, v.nameFr, v.nameAr].some((x) => x.toLowerCase().includes(s)),
          )
        : variants;
      return route.fulfill({
        json: { success: true, data, total: data.length, page: 1, totalPages: 1 },
      });
    }
    if (path === "/api/pos/quote")
      return route.fulfill({ json: { success: true, data: quote(body.items) } });
    if (path === "/api/pos/sales" && method === "POST") {
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
      if (state.failPrice)
        return route.fulfill({
          status: 409,
          json: { error: "Les prix ou les articles ont changé. Vérifiez à nouveau le panier." },
        });
      const q = quote(body.items);
      let sale = receipts.get(key!);
      if (!sale) {
        sale = {
          id: "abcdefabcdefabcdefabcde" + (receipts.size + 1).toString(16),
          reference: "POS-ABCDEFABCDEFABCDEFABCDE" + (receipts.size + 1).toString(16),
          currency: "MAD",
          cashSessionId: body.cashSessionId ?? null,
          cashierId: actor,
          cashierName: "Caissier Test",
          createdAt: "2026-11-23T10:00:00Z",
          paymentMethod: body.paymentMethod,
          receivedCents: body.receivedCents,
          changeCents: body.receivedCents - q.totalCents,
          totalCents: q.totalCents,
          savingsCents: q.savingsCents,
          items: q.lines,
        };
        receipts.set(key!, sale);
      }
      if (state.networkAfterCommit) return route.abort("failed");
      return route.fulfill({ status: 201, json: { success: true, data: sale } });
    }
    if (path.startsWith("/api/pos/sales/by-key/")) {
      const sale = receipts.get(decodeURIComponent(path.split("/").at(-1)!));
      return route.fulfill({
        status: sale ? 200 : 404,
        json: sale ? { success: true, data: sale } : { error: "Absent" },
      });
    }
    if (path === "/api/pos/sales") {
      if (state.historyDelay) await new Promise((r) => setTimeout(r, state.historyDelay));
      if (state.historyFailure) return route.fulfill({ status: 503, json: { error: "Offline" } });
      const search = (url.searchParams.get("search") ?? "")
        .replace(/^#/, "")
        .replace(/^POS-/i, "")
        .toLowerCase();
      const filtered = [...receipts.values()].filter(
        (r) =>
          r.id.includes(search) &&
          (!url.searchParams.get("cashierId") ||
            r.cashierId === url.searchParams.get("cashierId")) &&
          (!url.searchParams.get("paymentMethod") ||
            r.paymentMethod === url.searchParams.get("paymentMethod")) &&
          (!url.searchParams.get("from") ||
            r.createdAt.slice(0, 10) >= url.searchParams.get("from")!) &&
          (!url.searchParams.get("to") || r.createdAt.slice(0, 10) <= url.searchParams.get("to")!),
      );
      const totalPages = Math.ceil(filtered.length / 25),
        page = Math.min(Number(url.searchParams.get("page") ?? 1), Math.max(1, totalPages));
      try {
        return await route.fulfill({
          json: {
            success: true,
            data: filtered.slice((page - 1) * 25, page * 25),
            total: filtered.length,
            page,
            totalPages,
            cashiers: [{ id: actor, name: "Caissier Test" }],
            scope: permissions.includes("pos.read") ? "ALL" : "OWN",
            today: {
              count: filtered.length,
              totalCents: filtered.reduce((s, r) => s + r.totalCents, 0),
            },
          },
        });
      } catch {
        return;
      }
    }
    if (path.startsWith("/api/pos/sales/")) {
      const sale = [...receipts.values()].find((s) => s.id === path.split("/").at(-1));
      return route.fulfill({
        status: sale ? 200 : 404,
        json: sale ? { success: true, data: sale } : { error: "Absent" },
      });
    }
    return route.fulfill({
      json: { success: true, data: [], total: 0, unread: 0, page: 1, totalPages: 0 },
    });
  });
  page.on("dialog", (d) => d.accept());
  return { calls, receipts, state };
}
export const cart = (page: Page) => page.getByRole("complementary", { name: "Panier de caisse" });
export const add = (page: Page) =>
  page.getByRole("button", { name: "Ajouter Abaya test · Noir · M", exact: true });
export const sales = (f: Awaited<ReturnType<typeof fixture>>) =>
  f.calls.filter((c) => c.path === "/api/pos/sales" && c.method === "POST");
