import { test, expect, type BrowserContext, type Page } from "@playwright/test";
const identity = { id: "a".repeat(24), role: "ADMIN", authVersion: 0, permissions: [] as string[] };
const profileKey = "imad:admin:profile";
async function fixture(context: BrowserContext) {
 const control = { expire: false, refreshFailure: false, refreshes: 0, migrations: 0, logoutFailure: false, businessWrites: [] as string[], requests: [] as {path:string;cookie:boolean;bearer:boolean;mode:string|undefined;identity:string|undefined}[] };
 const install = async () => context.addCookies([{name:'imad_admin_refresh',value:'opaque-refresh-fixture',url:'http://127.0.0.1:3131',httpOnly:true,sameSite:'Strict'}]);
 await context.route('**/api/**', async route => {
  const req=route.request(),path=new URL(req.url()).pathname,h=await req.allHeaders();
  const hasCookie=!!h.cookie?.includes('imad_admin_access=opaque-access-fixture');
  control.requests.push({path,cookie:hasCookie,bearer:!!h.authorization,mode:h['x-imad-admin-session'],identity:h['x-imad-admin-identity']});
  const response={success:true,data:{mode:'cookie',identity}};
  const respond=async()=>{await install();return route.fulfill({headers:{'content-type':'application/json','set-cookie':'imad_admin_access=opaque-access-fixture; Path=/; HttpOnly; SameSite=Strict'},body:JSON.stringify(response)});};
  if(path==='/api/auth/login'){expect(h['x-imad-admin-session']).toBe('cookie');return respond();}
  if(path==='/api/auth/session/migrate'){control.migrations++;return respond();}
  if(path==='/api/auth/session')return hasCookie?route.fulfill({json:response}):route.fulfill({status:401,json:{success:false}});
  if(path==='/api/auth/refresh'){
   control.refreshes++;
   if(control.refreshFailure)return route.fulfill({status:503});
   if(!h.cookie?.includes('imad_admin_refresh='))return route.fulfill({status:401});
   control.expire=false;return respond();
  }
  if(path==='/api/auth/logout'){
   if(control.logoutFailure)return route.abort('failed');
   await context.clearCookies();return route.fulfill({json:{success:true}});
  }
  if(req.method()!=='GET'){control.businessWrites.push(req.method()+' '+path);return route.fulfill({status:405});}
  if(path!=='/api/settings'&&path!=='/api/categories'&&(!hasCookie||control.expire))return route.fulfill({status:401});
  if(path==='/api/pos/sales/'+'b'.repeat(24))return route.fulfill({json:{success:true,data:{id:'b'.repeat(24),reference:'POS-FICTIF',currency:'MAD',cashierId:identity.id,cashierName:'Caissier fictif',paymentMethod:'CASH',totalCents:23000,savingsCents:0,receivedCents:23000,changeCents:0,createdAt:'2026-11-25T10:00:00Z',items:[]}}});
  const data=path==='/api/settings'?{shippingCost:30,shippingNote:'',whatsappNumber:'',metaPixelEnabled:false,codEnabled:true}:[];
  return route.fulfill({json:{success:true,data,total:0,totalPages:1,page:1,unread:0}});
 });
 return control;
}
async function signIn(page: Page) {
 await page.goto('/admin?tab=orders');
 await page.getByLabel('Adresse e-mail',{exact:true}).fill('owner@example.invalid');
 await page.getByLabel('Mot de passe',{exact:true}).fill('Fixture-Password-Only');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await expect(page.locator('.admin-workspace')).toBeVisible();
}
async function menu(page:Page){const b=page.getByRole('button',{name:'Navigation',exact:true});if(await b.isVisible())await b.click();}
test.afterEach(async({context})=>{await context.unrouteAll({behavior:'ignoreErrors'});});
for(const width of [390,768,1440])test(`Cookie login, reload and logout keep credentials out of JavaScript at ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:844});const c=await fixture(context);await signIn(page);
 const saved=await page.evaluate(key=>({profile:JSON.parse(localStorage.getItem(key)!),access:localStorage.getItem('adminToken'),refresh:localStorage.getItem('adminRefresh'),cookie:document.cookie}),profileKey);
 expect(saved.access).toBeNull();expect(saved.refresh).toBeNull();expect(saved.cookie).not.toContain('opaque-');expect(saved.profile).toEqual({id:identity.id,role:'ADMIN',permissions:[],sv:0});
 expect((await context.cookies()).filter(x=>x.name.startsWith('imad_admin_')).every(x=>x.httpOnly)).toBe(true);
 await page.reload();await expect(page.locator('.admin-workspace')).toBeVisible();
 expect(c.requests.filter(r=>r.path==='/api/orders').every(r=>!r.bearer&&r.cookie&&r.mode==='cookie'&&r.identity===identity.id+':0')).toBe(true);
 await menu(page);await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Connexion à votre espace',exact:true})).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),profileKey)).toBeNull();expect(c.businessWrites).toEqual([]);
});

test('Concurrent private reads renew an expired access cookie once without exposing either credential',async({page,context})=>{
 const c=await fixture(context);await signIn(page);const before=c.refreshes;c.expire=true;
 await page.getByRole('button',{name:'Actualiser les données',exact:true}).click();
 await expect.poll(()=>c.refreshes).toBe(before+1);await expect(page.locator('.admin-workspace')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('adminToken'))).toBeNull();
 expect(c.businessWrites).toEqual([]);
});

test('A temporary refresh or logout network failure preserves the current session for retry',async({page,context})=>{
 const c=await fixture(context);await signIn(page);c.expire=true;c.refreshFailure=true;
 await page.getByRole('button',{name:'Actualiser les données',exact:true}).click();
 await expect.poll(()=>c.refreshes).toBeGreaterThan(1);await expect(page.locator('.admin-workspace')).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),profileKey)).not.toBeNull();
 c.refreshFailure=false;c.expire=false;c.logoutFailure=true;
 await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'La déconnexion n’a pas abouti. Réessayez.'})).toBeVisible();await expect(page.locator('.admin-workspace')).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),profileKey)).not.toBeNull();
 c.logoutFailure=false;await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Connexion à votre espace',exact:true})).toBeVisible();expect(c.businessWrites).toEqual([]);
});

test('Legacy browser migration removes both credentials and preserves the cashier presentation identity',async({page,context})=>{
 const c=await fixture(context);const payload=Buffer.from(JSON.stringify({id:identity.id,role:'ADMIN',permissions:[],sv:0})).toString('base64url');
 await page.addInitScript(({token})=>{if(!localStorage.getItem('imad:admin:profile')){localStorage.setItem('adminToken',token);localStorage.setItem('adminRefresh','old.eyJpZCI6ImZpeHR1cmUifQ.signature');}},{token:`fixture.${payload}.fixture`});
 await page.goto('/admin?tab=orders');await expect(page.locator('.admin-workspace')).toBeVisible();expect(c.migrations).toBe(1);
 const state=await page.evaluate(key=>({profile:JSON.parse(localStorage.getItem(key)!),access:localStorage.getItem('adminToken'),refresh:localStorage.getItem('adminRefresh')}),profileKey);
 expect(state).toEqual({profile:{id:identity.id,role:'ADMIN',permissions:[],sv:0},access:null,refresh:null});expect(c.businessWrites).toEqual([]);
});

test('Logging out in another tab removes the old workspace and private identity',async({page,context})=>{
 const c=await fixture(context);await signIn(page);const second=await context.newPage();await second.goto('/admin?tab=orders');
 await expect(second.locator('.admin-workspace')).toBeVisible();await second.getByRole('button',{name:'Se déconnecter',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Connexion à votre espace',exact:true})).toBeVisible();expect(c.businessWrites).toEqual([]);
});

test('A separate receipt page restores the cookie identity and hides its ticket after logout in another tab',async({page,context})=>{
 const c=await fixture(context);await signIn(page);const receipt=await context.newPage();
 await receipt.goto('/admin/pos/receipt/'+'b'.repeat(24));await expect(receipt.getByText('POS-FICTIF',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();
 await expect(receipt.getByText('POS-FICTIF',{exact:true})).toHaveCount(0);
 await expect(receipt.locator('.pos-print-page > p[role=alert]')).toContainText('Connectez-vous');expect(c.businessWrites).toEqual([]);
});
