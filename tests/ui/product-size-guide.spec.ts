import { test, expect } from "@playwright/test";
for (const width of [320,390,1440]) {
    test(`Verified garment measurements and product facts stay readable without selecting or ordering at ${width}px`, async ({page},info)=>{
        await page.setViewportSize({width,height:900});
        let writes=0;
        await page.route("**/api/orders",route=>{writes++;return route.abort()});
        await page.goto('/products/fixture-size-guide');
        await page.getByText('كيف تختارون المقاس المناسب؟',{exact:true}).click();
        const table=page.getByRole('table');
        await expect(table).toContainText('100'); await expect(table).toContainText('120');
        await expect(page.locator('.product-size-guide')).toContainText('ليس قياسات الجسم');
        await expect(page.locator('.product-information-facts')).toContainText('خامة اختبار فقط');
        await expect(page.locator('.product-information-facts')).toContainText('تعليمات اختبار فقط');
        await expect(page.getByRole('button',{name:'اختاروا المقاس',exact:true})).toBeEnabled();
        await expect(page.locator('.size-options [aria-pressed="true"]')).toHaveCount(0);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.screenshot({path:info.outputPath(`size-guide-${width}.png`)});
        expect(writes).toBe(0);
    });
}
test('Missing measurements give footwear instructions without a fabricated conversion chart',async({page})=>{
    await page.goto('/products/fixture-sabot');
    await page.getByText('كيف تختارون المقاس المناسب؟',{exact:true}).click();
    await expect(page.locator('.product-size-guide')).toContainText('غير متوفرة حالياً');
    await expect(page.locator('.product-size-guide')).toContainText('قيسوا طول القدم');
    await expect(page.locator('.product-size-guide table')).toHaveCount(0);
    await expect(page.locator('.size-options [aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'اختاروا المقاس',exact:true})).toBeEnabled();
});

test('A verified footwear chart labels foot length rather than garment circumference',async({page})=>{
    await page.goto('/products/fixture-foot-guide');
    await page.getByText('كيف تختارون المقاس المناسب؟',{exact:true}).click();
    await expect(page.getByRole('table')).toContainText('25.5');
    await expect(page.getByRole('columnheader',{name:'طول القدم',exact:true})).toBeVisible();
    await expect(page.getByRole('table')).not.toContainText('محيط الصدر');
    await expect(page.locator('.size-options [aria-pressed="true"]')).toHaveCount(0);
});
