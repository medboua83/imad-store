import {test,expect} from '@playwright/test';
for (const width of [390,1440]) test(`Product measurement edits require renewed verification and survive saving at ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    const category={id:'111111111111111111111111',slug:'abayas',nameFr:'Abayas',nameAr:'عبايات',nameEn:'Abayas'};
    let product:any={id:'222222222222222222222222',slug:'guide-fixture',status:'ACTIVE',category,nameFr:'Article mesures test',nameAr:'منتج قياسات تجريبي',nameEn:'Fixture',descriptionFr:'',descriptionAr:'',descriptionEn:'',price:200,images:['/images/catalogue-test/abaya.webp'],variants:[{id:'333333333333333333333331',sku:'GUIDE-M',size:'M',stock:5,color:'#000000',colorNameFr:'Noir',colorNameAr:'أسود',colorNameEn:'Black'}],productInformation:{composition:'Matière fictive de test',sizeGuide:{basis:'GARMENT',verified:true,rows:[{size:'M',chest:100,length:120}]}}};
    let writes=0;
    await page.addInitScript(()=>{localStorage.setItem('adminToken','isolated-guide-test');localStorage.setItem('imad-admin-language','fr')});
    await page.route('**/api/**',async route=>{
        const req=route.request(),path=new URL(req.url()).pathname;
        if(req.method()!=='GET'){
            if(req.method()!=='PUT'||path!==`/api/products/${product.id}`)return route.fulfill({status:405});
            writes++; product={...product,...req.postDataJSON(),category};return route.fulfill({json:{success:true,data:product}});
        }
        const data=path==='/api/categories'?[category]:path==='/api/products/admin/catalog'?[product]:[];
        return route.fulfill({json:{success:true,data,total:data.length,unread:0}});
    });
    await page.goto('/admin?tab=products');
    await page.getByRole('button',{name:'Modifier Article mesures test',exact:true}).click();
    const editor=page.locator('.product-information-editor');
    const confirmed=editor.getByRole('checkbox');
    await expect(confirmed).toBeChecked();
    await editor.getByLabel('Tour de poitrine · cm',{exact:true}).fill('102');
    await expect(confirmed).not.toBeChecked();
    await page.getByRole('button',{name:'Enregistrer le produit',exact:true}).click();
    await expect(page.getByText('Produit enregistré. Le catalogue est à jour.',{exact:true})).toBeVisible();
    expect(product.productInformation.sizeGuide.verified).toBe(false);
    expect(product.variants[0].stock).toBe(5);
    await page.getByRole('button',{name:'Modifier Article mesures test',exact:true}).click();
    await expect(editor.getByLabel('Tour de poitrine · cm',{exact:true})).toHaveValue('102');
    await confirmed.check();
    await page.screenshot({path:info.outputPath(`admin-guide-${width}.png`)});
    await page.getByRole('button',{name:'Enregistrer le produit',exact:true}).click();
    await expect(page.getByText('Produit enregistré. Le catalogue est à jour.',{exact:true})).toBeVisible();
    expect(product.productInformation.sizeGuide.verified).toBe(true);
    expect(product.productInformation.composition).toBe('Matière fictive de test');
    expect(writes).toBe(2);
});
