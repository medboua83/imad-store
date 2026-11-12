import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`Colour photo survives add, refresh and a single checkout expansion at ${width}px`, async ({page}, info) => {
    await page.setViewportSize({width, height:900});
    let orders = 0;
    await page.route("**/api/orders", route => { orders++; return route.abort(); });
    await page.goto("/products/fixture-one-size?stats_test=1");
    const sizeButtons = page.locator(".size-options button");
    await expect(sizeButtons).toHaveText(["قياسي", "مقاس موحد"]);
    await page.getByRole("button", {name:"بني", exact:true}).click();
    await expect(page.getByRole("button", {name:"مقاس موحد",exact:true})).toHaveAttribute("aria-pressed","true");
    const image = new URL("/images/catalogue-test/abaya.webp", page.url()).href;
    await expect(page.locator(".gallery-stage img")).toHaveJSProperty("src",image);
    await page.getByRole("button",{name:"إضافة إلى السلة",exact:true}).click();
    const bag = page.getByRole("dialog");
    await expect(bag.locator(".bag-line-photo img")).toHaveJSProperty("src",image);
    await expect(bag.locator(".bag-line-detail")).toContainText("بني · مقاس موحد");
    await page.getByRole("button",{name:"إغلاق السلة",exact:true}).click();
    const view = page.getByRole("button",{name:"عرض السلة",exact:true});
    await expect(view).toBeEnabled();
    await expect(page.locator(".purchase-price")).toContainText("230.00");
    await view.press("Enter");
    await expect(bag.locator(".bag-quantity span")).toHaveText("1");
    await page.getByRole("button",{name:"إغلاق السلة",exact:true}).click();
    await page.reload();
    await page.locator(".site-header .cart-toggle").click();
    await expect(bag.locator(".bag-line-photo img")).toHaveJSProperty("src",image);
    await page.getByRole("link",{name:"متابعة الطلب",exact:true}).click();
    const summary = page.locator(".checkout-order-disclosure");
    if (width < 768) await summary.locator(":scope > summary").click();
    await expect(summary.locator("details")).toHaveCount(0);
    await expect(summary.locator(".bag-line-photo img")).toHaveJSProperty("src",image);
    await expect(summary.locator(".bag-line-detail")).toContainText("بني · مقاس موحد");
    await expect(summary.locator(".bag-grand-total")).toContainText("275.00");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("imad-store-cart")!).state.items);
    expect(saved.map((item: {variantId:string;quantity:number}) => [item.variantId,item.quantity])).toEqual([["999999999999999999999991",1]]);
    expect(saved[0].images).toEqual(["/images/catalogue-test/abaya.webp"]);
    expect(orders).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`checkout-colour-${width}.png`)});
  });

  test(`Size and colour filters stay distinct and retain actual SKU choices at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto("/shop?search=one-size-fixture&filters=open&size=Unique");
    const size = page.getByRole("combobox",{name:"المقاس",exact:true});
    await expect(size.locator("option")).toHaveText(["جميع المقاسات","قياسي","مقاس موحد"]);
    await expect(size).toHaveValue("unique");
    await expect(page.getByRole("combobox",{name:"اللون",exact:true}).locator("option")).toHaveText(["جميع الألوان","بني — خيار 1","بني — خيار 2"]);
    await page.getByRole("button",{name:"إغلاق الفلاتر",exact:true}).click();
    await page.locator(".catalog-card-image").click();
    await expect(page.getByRole("button",{name:"مقاس موحد",exact:true})).toHaveAttribute("aria-pressed","true");
    await page.getByRole("button",{name:"أسود",exact:true}).click();
    await expect(page.getByRole("button",{name:"مقاس موحد",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"إضافة إلى السلة",exact:true}).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("imad-store-cart")!).state.items);
    expect(saved[0].variantId).toBe("999999999999999999999992");
    expect(saved[0].stock).toBe(2);
    expect(saved[0].size).toBe("unique");
  });
}

test("A legacy cart repairs its photo from the current variant mapping without changing quantity", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("imad-store-cart",JSON.stringify({version:0,state:{items:[{
    productId:"222222222222222222222222",productSlug:"fixture-one-size",variantId:"999999999999999999999991",
    nameFr:"Sabot fictif",nameAr:"صابو تجريبي",nameEn:"Fixture clog",colorNameFr:"بني",colorNameAr:"بني",colorNameEn:"بني",
    price:230,size:"unique",stock:1,quantity:1,image:"/images/catalogue-test/sac.webp",images:["/images/catalogue-test/sac.webp"],
  }]}})));
  await page.goto("/checkout");
  const photo=page.locator(".checkout-summary-items .bag-line-photo img");
  await expect(photo).toHaveJSProperty("src",new URL("/images/catalogue-test/abaya.webp",page.url()).href);
  await expect(page.locator(".checkout-summary-items .bag-quantity span")).toHaveText("1");
  await page.reload();
  await expect(photo).toHaveJSProperty("src",new URL("/images/catalogue-test/abaya.webp",page.url()).href);
});

test("Equivalent display sizes never hide another SKU or pool their stock", async ({page}) => {
  await page.goto("/products/fixture-one-size");
  await page.getByRole("button",{name:"إضافة إلى السلة",exact:true}).click();
  await page.getByRole("button",{name:"إغلاق السلة",exact:true}).click();
  await expect(page.getByRole("button",{name:"عرض السلة",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"مقاس موحد",exact:true}).click();
  await expect(page.getByLabel("الكمية",{exact:true})).toHaveAttribute("max","2");
  await page.getByRole("button",{name:"إضافة إلى السلة",exact:true}).click();
  const items = await page.evaluate(() => JSON.parse(localStorage.getItem("imad-store-cart")!).state.items);
  expect(items.map((i: {variantId:string;stock:number;quantity:number}) => [i.variantId,i.stock,i.quantity])).toEqual([
    ["999999999999999999999991",1,1],["999999999999999999999994",2,1],
  ]);
});

test("A failed colour photo shows a placeholder instead of another colour", async ({page}) => {
  await page.route("**/images/catalogue-test/abaya.webp",route => route.fulfill({status:404,body:""}));
  await page.goto("/products/fixture-one-size");
  await page.getByRole("button",{name:"إضافة إلى السلة",exact:true}).click();
  const bag=page.getByRole("dialog");
  await expect(bag.locator(".bag-line-photo .product-photo-placeholder")).toBeVisible();
  await expect(bag.locator(".bag-line-photo img")).toHaveCount(0);
  await expect(bag.locator(".bag-line-detail")).toContainText("بني · مقاس موحد");
});
