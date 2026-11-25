import { test, expect, type BrowserContext } from "@playwright/test";
const identity={id:'a'.repeat(24),role:'ADMIN',authVersion:0,permissions:[]};
const checks=[
 {id:'identity',label:'Coordonnées publiques',detail:'Vérifiez le nom, l’e-mail, le téléphone et l’adresse de votre boutique.',href:'/admin?tab=commerce#branding-settings'},
 {id:'policies',label:'Informations et conditions commerciales',detail:'Les coordonnées juridiques et les trois textes doivent être complétés et validés par le marchand.',href:'/admin?tab=content'},
 {id:'delivery',label:'Livraison et retours',detail:'Définissez les délais et la prise en charge des frais de retour. Les tarifs ne sont pas modifiés par ce contrôle.',href:'/admin?tab=commerce#shipping-settings'},
 {id:'mail',label:'Connexion SMTP enregistrée',detail:'Une configuration enregistrée ne prouve pas la réception des e-mails. Effectuez un essai de réception avant livraison.',href:'/admin?tab=team'},
 {id:'mfa',label:'Double authentification de votre compte',detail:'Activez votre application d’authentification et conservez vos codes de secours séparément.',href:'/admin?tab=account'},
 {id:'backup',label:'Sauvegarde hors serveur vérifiée',detail:'Le reçu d’une restauration réussie doit dater de moins de 36 heures. Sans reçu, le contrôle reste à terminer.',href:null},
 {id:'integrations',label:'Incidents d’envoi',detail:'Consultez les commandes et les connexions lorsqu’un envoi échoue. Aucune relance n’est effectuée ici.',href:'/admin?tab=orders'},
];
async function fixture(context:BrowserContext){
 const c={fail:false,invalid:false,reads:0,writes:[] as string[]};
 await context.setExtraHTTPHeaders({DNT:'1'});await context.route('**/*facebook*',route=>route.abort());
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()!=='GET'){c.writes.push(path);return route.fulfill({status:405})}
  if(path.startsWith('/api/auth/'))return route.fulfill({json:{success:true,data:{mode:'cookie',identity}}});
  if(path==='/api/settings/readiness'){
   c.reads++;return route.fulfill({status:c.fail?503:200,json:{success:true,data:c.invalid?{checkedAt:'invalid',checks:[]}:{checkedAt:'2026-11-25T12:00:00Z',completed:1,total:7,checks:checks.map(x=>({...x,ready:x.id==='integrations'}))}}});
  }
  if(path==='/api/settings/branding')return route.fulfill({json:{success:true,data:{revision:0,branding:{name:'IMAD Mode',logoUrl:'',darkLogoUrl:'',primaryColor:'#78551f',accentColor:'#e7cf97',backgroundColor:'#fcfaf6',contactEmail:'',contactPhone:'',contactAddress:''}}}});
  if(['/api/categories','/api/content','/api/settings','/api/products'].includes(path))return route.fallback();
  return route.fulfill({json:{success:true,data:[],total:0,totalPages:1,unread:0}});
 });return c;
}
test.afterEach(async({context})=>context.unrouteAll({behavior:'ignoreErrors'}));
for(const width of [320,768,1440])for(const ar of [false,true])test(`Read-only readiness ${width}px ${ar?'AR':'FR'}`,async({page,context},info)=>{
 await page.setViewportSize({width,height:900});const c=await fixture(context);await page.goto('/admin?tab=commerce#store-readiness');
 const section=page.locator('#store-readiness');await expect(section.locator('li')).toHaveCount(7);
 if(ar)await page.getByRole('combobox',{name:'Langue de l’administration / لغة لوحة الإدارة'}).selectOption('ar');
 await expect(section).toContainText(ar?'تجهيز المتجر':'Préparation de la boutique');
 await expect(section.locator('[data-ready="false"]')).toHaveCount(6);await expect(section.locator('[data-ready="true"]')).toHaveCount(1);
 await expect(section).toContainText(ar?'ليست شهادة قانونية':'n’est pas une certification juridique');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.screenshot({path:info.outputPath('readiness.png')});expect(c.writes).toEqual([]);
 await section.getByRole('button',{name:ar?'تحديث المراجعة':'Actualiser le bilan'}).click();await expect.poll(()=>c.reads).toBe(2);expect(c.writes).toEqual([]);
});
test('Read failure retains the last dated report and retry never publishes a setting',async({page,context})=>{
 const c=await fixture(context);await page.goto('/admin?tab=commerce#store-readiness');const section=page.locator('#store-readiness');await expect(section.locator('li')).toHaveCount(7);
 const time=await section.locator('time').getAttribute('datetime');c.fail=true;await section.getByRole('button',{name:'Actualiser le bilan'}).click();await expect(section.getByRole('alert')).toContainText('Bilan non actualisé');
 await expect(section.locator('li')).toHaveCount(7);await expect(section.locator('time')).toHaveAttribute('datetime',time!);expect(c.writes).toEqual([]);
 c.fail=false;await section.getByRole('button',{name:'Actualiser le bilan'}).click();await expect(section.getByRole('alert')).toHaveCount(0);expect(c.writes).toEqual([]);
});
test('Malformed response cannot display successful readiness',async({page,context})=>{
 const c=await fixture(context);c.invalid=true;await page.goto('/admin?tab=commerce#store-readiness');const section=page.locator('#store-readiness');await expect(section.getByRole('alert')).toBeVisible();await expect(section.locator('li')).toHaveCount(0);expect(c.writes).toEqual([]);
});
for(const width of [390,1440])test(`Standalone CRM stays unavailable with a clear explanation ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});const c=await fixture(context);
 await context.route('**/api/integrations/deskcomm',route=>route.fulfill({json:{success:true,data:{enabled:false,configured:false,updatedAt:null,connection:null,installation:{storeId:'12345678-1234-4234-8234-123456789012',mode:'standalone'}}}}));
 await page.goto('/admin?tab=deskcomm');await expect(page.getByRole('heading',{name:'Boutique autonome',exact:true})).toBeVisible();
 await expect(page.getByText('Cette boutique fonctionne sans CRM.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Enregistrer la configuration'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(c.writes).toEqual([]);
});
