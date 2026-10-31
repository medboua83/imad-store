import { test, expect } from "@playwright/test";

for (const route of ["/", "/shop", "/products/fixture-sabot"]) {
  test(`Opt-in browser diagnostics and critical assets work on ${route}`, async ({page}, info) => {
    await page.setViewportSize({width:390,height:844});
    const metrics: Record<string, unknown>[] = [];
    const interactions: Record<string, unknown>[] = [];
    const resources: string[] = [];
    page.on("request", r => resources.push(new URL(r.url()).pathname));
    page.on("console", message => {
      const text = message.text();
      if (text.startsWith("[IMAD_VITALS] ")) metrics.push(JSON.parse(text.slice(14)));
      if (text.startsWith("[IMAD_INTERACTION] ")) interactions.push(JSON.parse(text.slice(19)));
    });
    await page.goto(`${route}?measure=1&stats_test=1`);
    await expect(page.locator("h1")).toBeVisible();
    await expect.poll(() => metrics.some(m => m.name === "FCP")).toBe(true);
    await expect(page.locator('head link[rel="preload"][href="/images/brand/imad-mode-selected-v1.webp"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="preload"][href="/fonts/cormorant-wordmark.ttf"]')).toHaveCount(0);
    await page.getByRole("button", {name:"فتح القائمة",exact:true}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", {name:"إغلاق القائمة",exact:true}).click();
    const initialResources = [...resources];
    await page.goto("/contact?stats_test=1"); // Flush diagnostic callbacks on document hide.
    expect(initialResources.filter(p => p === "/images/brand/imad-mode-selected-v1.webp")).toHaveLength(1);
    if (route !== "/") expect(initialResources).not.toContain("/fonts/cormorant-wordmark.ttf");
    for (const metric of metrics) {
      expect(Number.isFinite(metric.value)).toBe(true);
      expect(metric.viewportWidth).toBe(390);
      expect(Object.keys(metric).sort()).toEqual(["name","rating","value","viewportWidth","visibility"]);
    }
    for (const interaction of interactions) {
      expect(Object.keys(interaction).sort()).toEqual(["inputDelay","presentationDelay","processingDuration"]);
      for (const value of Object.values(interaction)) expect(Number.isFinite(value)).toBe(true);
    }
    await info.attach("browser-loading-diagnostics", {body:JSON.stringify({
      route, viewport:{width:390,height:844}, network:"isolated local fixture, no throttling",
      notes:"Informational browser measurements; no Lighthouse score or field percentile.",
      metrics, interactions, resources:initialResources,
    },null,2),contentType:"application/json"});
  });
}

for (const width of [390,1440]) {
  test(`Only the first catalogue cover is urgent and a missing source recovers at ${width}px`, async ({page},info) => {
    await page.setViewportSize({width,height:900});
    await page.goto("/shop?search=loading-fixture&stats_test=1");
    const covers = page.locator(".catalog-card-image img");
    await expect(covers).toHaveCount(2);
    await expect(covers.first()).toHaveAttribute("loading","eager");
    await expect(covers.first()).toHaveAttribute("fetchpriority","high");
    await expect(covers.nth(1)).toHaveAttribute("loading","lazy");
    await expect(covers.nth(1)).not.toHaveAttribute("fetchpriority","high");
    await expect(covers.first()).toHaveAttribute("src",/\/images\/catalogue-test\/sac\.webp$/);
    await expect.poll(() => covers.first().evaluate((img:HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`catalogue-cover-recovered-${width}.png`)});
  });
}

test("Ordinary visits do not enable performance diagnostic logs", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const messages: string[] = [];
  page.on("console", m => {if (/\[IMAD_(VITALS|INTERACTION)\]/.test(m.text())) messages.push(m.text());});
  await page.goto("/shop?stats_test=1");
  await page.getByRole("button", {name:"فتح القائمة",exact:true}).click();
  await page.getByRole("button", {name:"إغلاق القائمة",exact:true}).click();
  await page.goto("/contact?stats_test=1");
  expect(messages).toEqual([]);
});
