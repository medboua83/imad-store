import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { defaultStoreBranding, type StoreBranding } from "@imad-store/shared";
const logo = '/uploads/' + 'a'.repeat(64) + '.webp';
async function fixture(context: BrowserContext) {
    const c = { branding: { ...defaultStoreBranding }, revision: 0, failRead: false, failSave: false, lost: false, conflict: false,
        writes: [] as any[], otherWrites: [] as string[] };
    const auth = { success: true, data: { mode: 'cookie', identity: { id: 'a'.repeat(24), role: 'ADMIN', authVersion: 0, permissions: [] } } };
    await context.route('**/uploads/*.webp', route => route.fulfill({path:'apps/web/public/images/brand/imad-mode-selected-v1.webp',contentType:'image/webp'}));
    await context.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (path.startsWith('/api/auth/')) return route.fulfill({ json: auth });
        if (path === '/api/settings/branding') {
            if (req.method() === 'PUT') {
                const body = req.postDataJSON(); c.writes.push(body);
                if (c.failSave) return route.fulfill({status:503,json:{error:'Échec temporaire'}});
                if (c.conflict) { c.branding.name = 'Autre fenêtre'; c.revision++; return route.fulfill({status:409,json:{error:'L’identité a changé dans une autre fenêtre. Rechargez avant de réessayer.'}}); }
                c.branding = body.branding; c.revision++;
                if (c.lost) return route.abort('failed');
            }
            return route.fulfill({status:c.failRead?503:200,json:{success:true,data:{branding:c.branding,revision:c.revision}}});
        }
        if (path === '/api/uploads' && req.method() === 'POST') return route.fulfill({status:201,json:{success:true,data:{url:logo}}});
        if (req.method() !== 'GET') { c.otherWrites.push(path); return route.fulfill({status:405}); }
        if (path === '/api/settings') return route.fulfill({json:{success:true,data:{shippingCost:40,freeShippingMin:500,codEnabled:true,metaPixelEnabled:false,branding:c.branding}}});
        if (['/api/categories','/api/content','/api/products'].includes(path)) return route.fallback();
        return route.fulfill({json:{success:true,data:[],unread:0,total:0,totalPages:1}});
    });
    return c;
}
async function start(page: Page, ar = false) {
    await page.goto('/admin?tab=commerce#branding-settings');
    const section = page.locator('#branding-settings');
    await expect(section.getByLabel('Nom de la boutique',{exact:true})).toHaveValue(defaultStoreBranding.name);
    if (ar) await page.getByRole('combobox',{name:'Langue de l’administration / لغة لوحة الإدارة'}).selectOption('ar');
    return section;
}
test.afterEach(async ({context}) => context.unrouteAll({behavior:'ignoreErrors'}));
for (const width of [390,768,1440]) for (const ar of [false,true]) test(`Private identity preview and publication ${width}px ${ar?'AR':'FR'}`, async ({page,context}, info) => {
    await page.setViewportSize({width,height:900}); const c=await fixture(context); const s=await start(page,ar);
    await s.getByLabel(ar?'اسم المتجر':'Nom de la boutique',{exact:true}).fill('Atelier Démonstration');
    await s.getByLabel(ar?'البريد الإلكتروني للتواصل':'E-mail de contact',{exact:true}).fill('contact@example.invalid');
    await s.getByLabel(ar?'هاتف التواصل':'Téléphone de contact',{exact:true}).fill('+212 600 000 099');
    await s.getByLabel(ar?'العنوان العام':'Adresse publique',{exact:true}).fill('Adresse fictive\nRabat');
    await s.getByLabel(ar?'اللون الرئيسي':'Couleur principale',{exact:true}).fill('#163c31');
    await s.getByLabel(ar?'اللون المميز':'Couleur d’accent',{exact:true}).fill('#f5dd95');
    await expect(s.getByRole('region',{name:ar?'معاينة خاصة للهوية':'Aperçu privé de l’identité'})).toContainText('Atelier Démonstration');
    expect(c.writes).toHaveLength(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await s.screenshot({path:info.outputPath('branding-preview.png')});
    await s.getByRole('button',{name:ar?'حفظ الهوية ونشرها':'Enregistrer et publier l’identité',exact:true}).click();
    await expect(s.getByRole('status')).toContainText(ar?'تم حفظ الهوية':'Identité enregistrée');
    expect(c.writes).toHaveLength(1); expect(c.otherWrites).toEqual([]);
    await page.goto('/contact');
    await expect(page.locator('.site-footer')).toContainText('Atelier Démonstration');
    await expect(page.locator('.contact-page a[href="mailto:contact@example.invalid"]')).toBeVisible();
    await expect(page.locator('.contact-page address')).toContainText('Rabat');
    await expect(page.locator('.site-header .brand-text-logo')).toHaveText('Atelier Démonstration');
    expect(await page.locator('.site-footer').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(22, 60, 49)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('branded-contact.png'),fullPage:true});
});
test('Default palette and logo remain unchanged at mobile width', async ({page,context}) => {
    await page.setViewportSize({width:390,height:844}); await fixture(context); await page.goto('/');
    await expect(page.locator('.site-header .brand-logo')).toBeVisible();
    await expect(page.locator('.brand-theme')).not.toHaveAttribute('data-custom-primary');
    await expect(page.locator('.brand-theme')).not.toHaveAttribute('data-custom-accent');
    await expect(page.locator('.brand-theme')).not.toHaveAttribute('data-custom-background');
});
test('Network failure preserves unsaved identity and retry succeeds once', async ({page,context}) => {
    const c=await fixture(context); const s=await start(page); c.failSave=true;
    await s.getByLabel('Nom de la boutique',{exact:true}).fill('Mon brouillon');
    await s.getByRole('button',{name:'Enregistrer et publier l’identité',exact:true}).click();
    await expect(s.getByRole('alert')).toContainText('Échec temporaire');
    await expect(s.getByLabel('Nom de la boutique',{exact:true})).toHaveValue('Mon brouillon');
    c.failSave=false; await s.getByRole('button',{name:'Enregistrer et publier l’identité',exact:true}).click();
    await expect(s.getByRole('status')).toContainText('Identité enregistrée'); expect(c.revision).toBe(1);
});
test('Lost save response is reconciled without a second publication', async ({page,context}) => {
    const c=await fixture(context); const s=await start(page); c.lost=true;
    await s.getByLabel('Nom de la boutique',{exact:true}).fill('  Atelier privé  ');
    await s.getByRole('button',{name:'Enregistrer et publier l’identité',exact:true}).click();
    await expect(s.getByRole('status')).toContainText('Identité enregistrée');
    expect(c.writes).toHaveLength(1); await expect(s.getByLabel('Nom de la boutique',{exact:true})).toHaveValue('Atelier privé');
});
test('Concurrent edits are not overwritten and explicit reload recovers', async ({page,context}) => {
    const c=await fixture(context); const s=await start(page); c.conflict=true;
    await s.getByLabel('Nom de la boutique',{exact:true}).fill('Mon brouillon');
    const save=s.getByRole('button',{name:'Enregistrer et publier l’identité',exact:true}); await save.click();
    await expect(save).toBeDisabled(); await expect(s.getByLabel('Nom de la boutique',{exact:true})).toHaveValue('Mon brouillon');
    await s.getByRole('button',{name:'Recharger les valeurs enregistrées',exact:true}).click();
    await expect(s.getByLabel('Nom de la boutique',{exact:true})).toHaveValue('Autre fenêtre'); expect(c.writes).toHaveLength(1);
});
test('Transparent logos retain their full frame, dark variant and removable preview', async ({page,context}) => {
    const c=await fixture(context); const s=await start(page);
    await s.getByLabel('Logo sur fond clair',{exact:true}).setInputFiles({name:'logo.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
    await expect(s.locator('.admin-branding-logo-field img')).toHaveCount(1);
    expect(c.writes).toHaveLength(0);
    await s.getByRole('button',{name:'Enregistrer et publier l’identité',exact:true}).click();
    await expect(s.getByRole('status')).toContainText('Identité enregistrée');
    await page.goto('/');
    const image=page.locator('.site-header .brand-custom-logo'); await expect(image).toBeVisible();
    expect(await image.evaluate(e=>getComputedStyle(e).objectFit)).toBe('contain');
    await page.goto('/admin?tab=commerce'); await expect(s.getByLabel('Nom de la boutique',{exact:true})).toHaveValue(defaultStoreBranding.name);
    await s.getByRole('button',{name:'Retirer ce logo',exact:true}).click();
    await s.getByRole('button',{name:'Annuler mes modifications',exact:true}).click();
    await expect(s.locator('.admin-branding-logo-field img')).toHaveCount(1);
});
test('Failed initial read never permits saving defaults over a merchant identity', async ({page,context}) => {
    const c=await fixture(context); c.failRead=true; await page.goto('/admin?tab=commerce'); const s=page.locator('#branding-settings');
    await expect(s.getByRole('alert')).toContainText('Impossible de charger');
    await expect(s.getByRole('button',{name:'Enregistrer et publier l’identité',exact:true})).toHaveCount(0);
    c.failRead=false; await s.getByRole('button',{name:'Recharger l’identité',exact:true}).click();
    await expect(s.getByLabel('Nom de la boutique',{exact:true})).toHaveValue(defaultStoreBranding.name); expect(c.writes).toHaveLength(0);
});
test('Long store names, dark logos and light button colours remain usable at 320px', async ({page,context}) => {
    await page.setViewportSize({width:320,height:844}); const c=await fixture(context);
    c.branding={...defaultStoreBranding,name:'Atelier de démonstration avec un nom de boutique très long',darkLogoUrl:logo,primaryColor:'#ffffff',accentColor:'#000000'};
    await page.goto('/contact');
    await expect(page.locator('.site-header .brand-text-logo')).toHaveText(c.branding.name);
    await expect(page.locator('.site-footer .brand-custom-logo')).toHaveAttribute('src',logo);
    expect(await page.locator('.site-footer').evaluate(e=>getComputedStyle(e).color)).toBe('rgb(0, 0, 0)');
    expect(await page.locator('.site-header .brand-text-logo').evaluate(e=>getComputedStyle(e).webkitLineClamp)).toBe('2');
    expect(await page.locator('.site-header .brand-text-logo').evaluate(e=>getComputedStyle(e).color)).not.toBe('rgb(255, 255, 255)');
    await expect(page.locator('.brand-contact-details')).toHaveCount(0);
    await page.goto('/');
    await expect(page.locator('.hero-product-price')).toBeVisible();
    await expect(page.locator('.hero-product-price')).toHaveCSS('color','rgb(0, 0, 0)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
