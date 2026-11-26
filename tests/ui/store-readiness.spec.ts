import { test, expect, type BrowserContext } from "@playwright/test";
const identity={id:'a'.repeat(24),role:'ADMIN',authVersion:0,permissions:[]};
const checks=[
 {id:'identity',label:'Coordonnées publiques',detail:'Vérifiez le nom, l’e-mail, le téléphone et l’adresse de votre boutique.',href:'/admin?tab=commerce#branding-settings'},
 {id:'policies',label:'Informations et conditions commerciales',detail:'Les coordonnées juridiques et les trois textes doivent être complétés et validés par le marchand.',href:'/admin?tab=content'},
 {id:'delivery',label:'Livraison et retours',detail:'Définissez les délais et la prise en charge des frais de retour. Les tarifs ne sont pas modifiés par ce contrôle.',href:'/admin?tab=commerce#shipping-settings'},
 {id:'mail',label:'Connexion SMTP enregistrée',detail:'Une configuration enregistrée ne prouve pas la réception des e-mails. Effectuez un essai de réception avant livraison.',href:'/admin?tab=mail'},
 {id:'mfa',label:'Double authentification de votre compte',detail:'Activez votre application d’authentification et conservez vos codes de secours séparément.',href:'/admin?tab=account'},
 {id:'backup',label:'Sauvegarde hors serveur vérifiée',detail:'Le reçu d’une restauration réussie doit dater de moins de 36 heures. Sans reçu, le contrôle reste à terminer.',href:null},
 {id:'integrations',label:'Incidents d’envoi',detail:'Consultez les commandes et les connexions lorsqu’un envoi échoue. Aucune relance n’est effectuée ici.',href:'/admin?tab=orders'},
];
async function fixture(context:BrowserContext,account:{id:string;role:string;authVersion:number;permissions:string[]}=identity){
 const c={fail:false,invalid:false,allReady:false,mismatchedCount:false,duplicate:false,missingClock:false,missingIncidents:false,inconsistentIncidents:false,incidents:{carrier:0,crm:0,accessMail:0},reads:0,writes:[] as string[]};
 await context.setExtraHTTPHeaders({DNT:'1'});await context.route('**/*facebook*',route=>route.abort());
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()!=='GET'){c.writes.push(path);return route.fulfill({status:405})}
  if(path.startsWith('/api/auth/'))return route.fulfill({json:{success:true,data:{mode:'cookie',identity:account}}});
  if(path==='/api/settings/readiness'){
   c.reads++;const rows=checks.map(x=>({...x,href:x.id==='mail'&&account.role!=='ADMIN'?null:x.href,ready:c.allReady||(x.id==='integrations'&&(c.inconsistentIncidents||Object.values(c.incidents).every(count=>count===0)))}));
   if(c.duplicate)rows[1].id=rows[0].id;
   return route.fulfill({status:c.fail?503:200,json:{success:true,data:c.invalid?{checkedAt:'invalid',checks:[]}:{checkedAt:'2026-11-25T12:00:00Z',checkedAtText:c.missingClock?null:{fr:'25/11/2026 12:00',ar:'25/11/2026 12:00 — توقيت المغرب'},incidents:c.missingIncidents?null:c.incidents,completed:c.mismatchedCount?7:rows.filter(x=>x.ready).length,total:7,checks:rows}}});
  }
  if(path==='/api/team/gmail')return route.fulfill({json:{success:true,data:{enabled:false,hasPassword:false,gmailUser:'',port:465,revision:0}}});
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
  await expect(section.getByRole('listitem')).toHaveCount(6);
  const summary=section.locator('summary');await expect(summary).toHaveText(ar?'الفحوصات المكتملة (1)':'Contrôles satisfaits (1)');
  expect(await summary.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await summary.focus();await summary.press('Enter');await expect(section.getByRole('listitem')).toHaveCount(7);
  await summary.press('Enter');await expect(section.getByRole('listitem')).toHaveCount(6);
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
for(const mismatch of ['count','duplicate','clock','missing-incidents','negative-incidents','incident-state'])test(`Inconsistent ${mismatch} cannot replace a previously dated report`,async({page,context})=>{
 const c=await fixture(context);await page.goto('/admin?tab=commerce#store-readiness');const section=page.locator('#store-readiness');await expect(section.getByRole('listitem')).toHaveCount(6);
 c.mismatchedCount=mismatch==='count';c.duplicate=mismatch==='duplicate';c.missingClock=mismatch==='clock';c.missingIncidents=mismatch==='missing-incidents';
 if(mismatch==='negative-incidents')c.incidents.carrier=-1;
 if(mismatch==='incident-state'){c.incidents.carrier=1;c.inconsistentIncidents=true;}
 await section.getByRole('button',{name:'Actualiser le bilan'}).click();
 await expect(section.getByRole('alert')).toBeVisible();await expect(section).toContainText('1 / 7');await expect(section.getByRole('listitem')).toHaveCount(6);expect(c.writes).toEqual([]);
});
for(const width of [320,1440])for(const ar of [false,true])test(`Incident sources expose read-only actions ${width}px ${ar?'AR':'FR'}`,async({page,context},info)=>{
 await page.setViewportSize({width,height:900});const c=await fixture(context);c.incidents={carrier:2,crm:1,accessMail:1};await page.goto('/admin?tab=commerce#store-readiness');
 if(ar)await page.getByRole('combobox',{name:'Langue de l’administration / لغة لوحة الإدارة'}).selectOption('ar');
 const section=page.locator('#store-readiness'),sources=section.getByRole('list',{name:ar?'مصدر المشكلات':'Origine des incidents'});
 await expect(sources.getByRole('listitem')).toHaveCount(3);
 await expect(sources).toContainText(ar?'طرود تحتاج إلى مراجعة: 2':'Colis à vérifier : 2');
 await expect(sources).toContainText(ar?'عمليات إرسال إلى CRM فشلت: 1':'Envois CRM en échec : 1');
 await expect(sources).toContainText(ar?'رسائل الوصول التي فشل إرسالها: 1':'E-mails d’accès en échec : 1');
 await expect(sources.getByRole('link')).toHaveCount(3);
 await expect(sources.locator('a[href="/admin?tab=deskcomm"]')).toBeVisible();await expect(sources.locator('a[href="/admin?tab=mail"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.screenshot({path:info.outputPath('incident-sources.png')});
 await sources.locator('a[href="/admin?tab=commerce#carrier-settings"]').click();
 const carrier=page.locator('#carrier-settings');await expect(carrier).toContainText(ar?'كل 30 ثانية تقريباً':'environ toutes les 30 secondes');
 await expect(carrier).toContainText(ar?'خاضعة للموافقة اليدوية':'soumis à une validation manuelle');expect(c.writes).toEqual([]);
});
for(const width of [390,1440])test(`Settings staff sees only permitted readiness actions ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});const c=await fixture(context,{...identity,role:'STAFF',permissions:['settings.manage']});c.incidents={carrier:1,crm:2,accessMail:1};
 await page.goto('/admin?tab=commerce#store-readiness');const section=page.locator('#store-readiness');
 await expect(section.getByRole('list',{name:'Origine des incidents'})).toBeVisible();
 await expect(section.locator('a[href="/admin?tab=commerce#carrier-settings"]')).toBeVisible();
 for(const tab of ['deskcomm','mail','content','orders'])await expect(section.locator(`a[href="/admin?tab=${tab}"]`)).toHaveCount(0);
 await expect(section.getByText('Un administrateur peut ouvrir ce réglage.',{exact:true})).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(c.writes).toEqual([]);
});
test('A CRM collaborator can investigate a CRM failure without unrelated actions or zero-count alerts',async({page,context})=>{
 await page.setViewportSize({width:390,height:900});const c=await fixture(context,{...identity,role:'STAFF',permissions:['settings.manage','crm.manage']});c.incidents.crm=1;
 await page.goto('/admin?tab=commerce#store-readiness');const sources=page.locator('#store-readiness').getByRole('list',{name:'Origine des incidents'});
 await expect(sources.getByRole('listitem')).toHaveCount(1);await expect(sources.getByRole('link',{name:'Ouvrir la connexion CRM',exact:true})).toBeVisible();
 await expect(sources.locator('a[href="/admin?tab=mail"]')).toHaveCount(0);await expect(sources).not.toContainText('Colis à vérifier');expect(c.writes).toEqual([]);
});
for(const width of [390,1440])test(`SMTP shortcut reaches the mail settings ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});const c=await fixture(context);await page.goto('/admin?tab=commerce#store-readiness');
 await page.locator('#store-readiness').getByRole('link',{name:'Ouvrir le réglage — Connexion SMTP enregistrée'}).click();
 await expect(page).toHaveURL(/\/admin\?tab=mail$/);await expect(page.getByRole('heading',{name:'E-mails et SMTP',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Gmail SMTP',exact:true})).toBeVisible();expect(c.writes).toEqual([]);
});
test('All satisfied checks remain accessible without an empty action list',async({page,context})=>{
 const c=await fixture(context);c.allReady=true;await page.goto('/admin?tab=commerce#store-readiness');const section=page.locator('#store-readiness');
 await expect(section.getByRole('status')).toHaveText('Aucune action indiquée par ce bilan.');await expect(section.getByRole('listitem')).toHaveCount(0);
 await section.locator('summary').click();await expect(section.getByRole('listitem')).toHaveCount(7);expect(c.writes).toEqual([]);
});
test.describe('Readiness clock',()=>{
 test.use({timezoneId:'America/Los_Angeles'});
 test('The server reading time survives another device timezone and outdated browser rules',async({page,context})=>{
  await fixture(context);await page.goto('/admin?tab=commerce#store-readiness');const time=page.locator('#store-readiness time');
  await expect(time).toHaveText('25/11/2026 12:00');await expect(time).toHaveAttribute('datetime','2026-11-25T12:00:00Z');await expect(time).toHaveAttribute('title','Heure du Maroc');
  await page.getByRole('combobox',{name:'Langue de l’administration / لغة لوحة الإدارة'}).selectOption('ar');await expect(time).toHaveText('25/11/2026 12:00 — توقيت المغرب');
 });
});
for(const width of [390,1440])test(`Standalone CRM stays unavailable with a clear explanation ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});const c=await fixture(context);
 await context.route('**/api/integrations/deskcomm',route=>route.fulfill({json:{success:true,data:{enabled:false,configured:false,updatedAt:null,connection:null,installation:{storeId:'12345678-1234-4234-8234-123456789012',mode:'standalone'}}}}));
 await page.goto('/admin?tab=deskcomm');await expect(page.getByRole('heading',{name:'Boutique autonome',exact:true})).toBeVisible();
 await expect(page.getByText('Cette boutique fonctionne sans CRM.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Enregistrer la configuration'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(c.writes).toEqual([]);
});
