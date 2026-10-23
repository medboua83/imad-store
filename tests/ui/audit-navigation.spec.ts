import { test, expect } from "@playwright/test";
for (const width of [390,1440]) test(`Conversion funnel remains readable at ${width}px`, async({page},info)=>{
    await page.setViewportSize({width,height:900});
    await page.addInitScript(()=>localStorage.setItem("adminToken","isolated-fixture"));
    await page.route("**/api/**",async route=>{
        const path=new URL(route.request().url()).pathname;
        const data=path==="/api/analytics/summary"?{days:7,visits:10,productViews:8,pageViews:15,convertedVisits:2,attributedOrders:3,orderRate:20,trackingSince:null,products:[],funnel:{cartVisits:5,checkoutVisits:4,confirmedOrders:1,shippedOrders:1,deliveredOrders:0,cancelledOrders:1,unknownOrders:1}}:[];
        await route.fulfill({json:{success:true,data,total:0,unread:0}});
    });
    await page.goto("/admin");
    if(width<768) await page.getByRole("button",{name:"Navigation",exact:true}).click();
    await page.getByRole("button",{name:"Statistiques",exact:true}).click();
    await expect(page.getByRole("region",{name:"Parcours de conversion"})).toContainText("Avec ajout au panier");
    await expect(page.getByRole("region",{name:"Parcours de conversion"})).toContainText("pas une preuve de paiement");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`analytics-${width}.png`),fullPage:true});
});
for (const width of [390, 1440])
    test(`Available collections, city search and FAQ at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/shop");
        await expect(page.locator(".catalog-grid a").first()).toBeVisible();
        await expect(page.locator('a[href*="empty-category"]')).toHaveCount(0);
        if (width === 390)
            expect((await page.locator(".catalog-grid").boundingBox())!.y).toBeLessThan(550);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath(`catalogue-${width}.png`), fullPage: true });
        await page.goto("/products/fixture-sabot");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await page.goto("/checkout");
        const search = page.getByLabel("بحث سريع عن مدينة", { exact: true });
        const city = page.locator("#checkout-city");
        await search.fill("طنج");
        await city.selectOption("tangier");
        await search.fill("ville inexistante");
        await expect(city).toHaveValue("tangier");
        await expect(page.locator("#city-search-results")).toContainText("لا توجد نتيجة");
        await search.fill("");
        await city.selectOption("rabat");
        await expect(city).toHaveValue("rabat");
        await page.goto("/contact#questions");
        await page.getByText("هل يلزم إنشاء حساب؟", { exact: true }).click();
        await expect(page.getByText("يمكنكم الطلب دون حساب.", { exact: false })).toBeVisible();
        expect(errors).toEqual([]);
    });
