import { test, expect, type BrowserContext, type Page } from "@playwright/test";
const profileKey = 'imad:admin:profile';
const identity = {id:'a'.repeat(24),role:'ADMIN',authVersion:0,permissions:[]};
const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const recoveryCodes = Array.from({length:10},(_,i)=>`FICT-ABCD-EF01-2345-6789-${String(i).padStart(4,'0')}`);
const qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4IoAAAAASUVORK5CYII=';
async function fixture(context:BrowserContext, enabled=false, connected=true) {
 const c={enabled,connected,readFailure:false,confirmFailure:false,setupFailure:false,lastBackup:false,recoveries:0,confirmations:0,setups:0,logins:0,cancellations:0,disables:0,businessWrites:[] as string[],lastConfirm:null as any};
 const auth={success:true,data:{mode:'cookie',identity}};
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const body=req.method()==='GET'?{}:req.postDataJSON();
  if(path==='/api/auth/session')return route.fulfill({status:c.connected?200:401,json:c.connected?auth:{success:false}});
  if(path==='/api/auth/refresh')return route.fulfill({status:c.connected?200:401,json:c.connected?auth:{success:false}});
  if(path==='/api/auth/login'){
   c.logins++;if(c.enabled&&!body.code)return route.fulfill({json:{success:true,data:{mfaRequired:true}}});
   if(c.enabled&&c.lastBackup&&body.code===recoveryCodes[0])return route.fulfill({status:409,json:{success:false,error:'Ce dernier code est réservé à la récupération. Choisissez « J’ai perdu mon téléphone » pour réinitialiser votre protection avec ce code.'}});
   if(c.enabled&&!['123456',recoveryCodes[0]].includes(body.code))return route.fulfill({status:400,json:{success:false,error:'Code incorrect, expiré ou déjà utilisé. Attendez le prochain code ou utilisez un code de secours.'}});
   c.connected=true;return route.fulfill({json:auth});
  }
  if(path==='/api/auth/mfa/recover'){
   c.recoveries++;expect(body).toEqual({email:'owner@example.invalid',password:'Fixture-Password',code:recoveryCodes[0]});c.enabled=false;c.connected=false;return route.fulfill({json:{success:true}});
  }
  if(path==='/api/auth/mfa')return route.fulfill({status:c.readFailure?503:200,json:{success:true,data:{enabled:c.enabled,enabledAt:c.enabled?'2026-11-25T12:00:00Z':null,recoveryCodesRemaining:c.enabled?9:0}}});
  if(path==='/api/auth/mfa/setup'){
   c.setups++;if(c.setupFailure)return route.abort('failed');
   expect(body).toEqual({currentPassword:'Fixture-Password'});
   return route.fulfill({json:{success:true,data:{setupId:'b'.repeat(32),secret,qr,recoveryCodes,expiresAt:new Date(Date.now()+600000).toISOString()}}});
  }
  if(path==='/api/auth/mfa/confirm'){
   c.confirmations++;c.lastConfirm=body;if(c.confirmFailure)return route.abort('failed');
   expect(body).toEqual({currentPassword:'Fixture-Password',setupId:'b'.repeat(32),code:'123456',recoverySaved:true});
   c.enabled=true;c.connected=false;return route.fulfill({json:{success:true}});
  }
  if(path==='/api/auth/mfa/cancel'){c.cancellations++;return route.fulfill({json:{success:true}});}
  if(path==='/api/auth/mfa/disable'){
   c.disables++;expect(body).toEqual({currentPassword:'Fixture-Password',code:recoveryCodes[1]});c.enabled=false;c.connected=false;return route.fulfill({json:{success:true}});
  }
  if(req.method()!=='GET'){c.businessWrites.push(req.method()+' '+path);return route.fulfill({status:405});}
  return route.fulfill({json:{success:true,data:path==='/api/settings'?{shippingCost:30,metaPixelEnabled:false,codEnabled:true}:[],total:0,totalPages:1,unread:0}});
 });
 return c;
}
async function start(page:Page,ar=false){await page.goto('/admin?tab=account');await expect(page.getByRole('heading',{name:'Double authentification',exact:true})).toBeVisible();if(ar)await page.getByRole('combobox',{name:'Langue de l’administration / لغة لوحة الإدارة'}).selectOption('ar');}
test.afterEach(async({context})=>context.unrouteAll({behavior:'ignoreErrors'}));
for(const width of [390,1440])for(const ar of [false,true])test(`Personal enrollment and backup download before activation at ${width}px ${ar?'AR':'FR'}`,async({page,context})=>{
 await page.setViewportSize({width,height:844});const c=await fixture(context);await start(page,ar);
 const section=page.locator('.admin-mfa');await section.getByLabel(ar?'كلمة المرور الحالية (أمان الحساب)':'Mot de passe actuel (sécurité du compte)',{exact:true}).fill('Fixture-Password');
 await section.getByRole('button',{name:ar?'إعداد المصادقة الثنائية':'Configurer la double authentification',exact:true}).click();
 await expect(section.getByRole('img')).toBeVisible();expect(c.setups).toBe(1);
 const activate=section.getByRole('button',{name:ar?'التفعيل وإعادة تسجيل الدخول':'Activer et me reconnecter',exact:true});await expect(activate).toBeDisabled();
 expect(await page.evaluate(()=>Object.values(localStorage).join(''))).not.toContain(secret);
 const download=page.waitForEvent('download');await section.getByRole('button',{name:ar?'تنزيل رموزي الاحتياطية':'Télécharger mes codes de secours',exact:true}).click();expect((await download).suggestedFilename()).toBe('codes-secours-boutique.txt');
 await expect(activate).toBeDisabled();await section.getByRole('checkbox').check();await section.getByLabel(ar?'رمز التطبيق':'Code de l’application',{exact:true}).fill('123456');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('mfa-setup.png'),fullPage:true});
 await activate.click();await expect(page.getByRole('heading',{name:ar?'الدخول إلى مساحة الإدارة':'Connexion à votre espace',exact:true})).toBeVisible();
 expect(c.confirmations).toBe(1);expect(c.enabled).toBe(true);expect(await page.evaluate(k=>localStorage.getItem(k),profileKey)).toBeNull();expect(c.businessWrites).toEqual([]);
});
test('Setup cancellation removes the QR and backup material without closing the session',async({page,context})=>{
 const c=await fixture(context);await start(page);const s=page.locator('.admin-mfa');await s.getByLabel('Mot de passe actuel (sécurité du compte)',{exact:true}).fill('Fixture-Password');await s.getByRole('button',{name:'Configurer la double authentification',exact:true}).click();await expect(s.getByLabel('Clé de configuration')).toBeVisible();
 await s.getByRole('button',{name:'Annuler',exact:true}).click();await expect(s.getByRole('img')).toHaveCount(0);expect(c.cancellations).toBe(1);expect(c.enabled).toBe(false);await expect(page.locator('.admin-workspace')).toBeVisible();expect(c.businessWrites).toEqual([]);
});
test('Uncertain activation retains the setup and acknowledgement for an explicit retry',async({page,context})=>{
 const c=await fixture(context);c.confirmFailure=true;await start(page);const s=page.locator('.admin-mfa');await s.getByLabel('Mot de passe actuel (sécurité du compte)',{exact:true}).fill('Fixture-Password');await s.getByRole('button',{name:'Configurer la double authentification',exact:true}).click();await s.getByRole('checkbox').check();await s.getByLabel('Code de l’application',{exact:true}).fill('123456');
 await s.getByRole('button',{name:'Activer et me reconnecter',exact:true}).click();await expect(s.getByRole('alert')).toContainText('Résultat incertain');await expect(s.getByRole('checkbox')).toBeChecked();await expect(s.getByLabel('Clé de configuration')).toHaveValue(secret);
 c.confirmFailure=false;await s.getByRole('button',{name:'Activer et me reconnecter',exact:true}).click();await expect(page.getByRole('heading',{name:'Connexion à votre espace',exact:true})).toBeVisible();expect(c.confirmations).toBe(2);expect(c.businessWrites).toEqual([]);
});
test('Unavailable status offers retry without presenting disabled protection as a fact',async({page,context})=>{
 const c=await fixture(context);c.readFailure=true;await page.goto('/admin?tab=account');const s=page.locator('.admin-mfa');await expect(s.getByRole('alert')).toBeVisible();await expect(s.getByRole('button',{name:'Configurer la double authentification',exact:true})).toHaveCount(0);
 c.readFailure=false;await s.getByRole('button',{name:'Réessayer',exact:true}).click();await expect(s.getByText('Protection non activée',{exact:true})).toBeVisible();expect(c.businessWrites).toEqual([]);
});
for(const width of [390,1440])test(`Password followed by MFA and single-use backup choice at ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:844});const c=await fixture(context,true,false);await page.goto('/admin');await page.getByLabel('Adresse e-mail',{exact:true}).fill('owner@example.invalid');await page.getByLabel('Mot de passe',{exact:true}).fill('Fixture-Password');await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 const code=page.getByLabel('Code de l’application',{exact:true});await expect(code).toBeFocused();await expect(page.locator('.admin-workspace')).toHaveCount(0);expect(await page.evaluate(k=>localStorage.getItem(k),profileKey)).toBeNull();
 await code.fill('000000');await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.locator('.admin-login-card [role=alert]')).toContainText('Code incorrect');await expect(code).toHaveValue('');
 await page.getByRole('button',{name:'Utiliser un code de secours',exact:true}).click();await page.getByLabel('Code de secours',{exact:true}).fill(recoveryCodes[0]);await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.locator('.admin-workspace')).toBeVisible();expect(c.logins).toBe(3);expect(c.businessWrites).toEqual([]);
});
test('An enabled account displays remaining backups and requires explicit password and factor to disable',async({page,context})=>{
 const c=await fixture(context,true);await start(page);const s=page.locator('.admin-mfa');await expect(s.getByText('Protection active',{exact:false})).toContainText('9 codes de secours');await s.getByRole('button',{name:'Désactiver la double authentification',exact:true}).click();await s.getByLabel('Mot de passe actuel (sécurité du compte)',{exact:true}).fill('Fixture-Password');await s.getByLabel('Code de l’application ou code de secours',{exact:true}).fill(recoveryCodes[1]);await s.getByRole('button',{name:'Désactiver et me reconnecter',exact:true}).click();await expect(page.getByRole('heading',{name:'Connexion à votre espace',exact:true})).toBeVisible();expect(c.disables).toBe(1);expect(c.businessWrites).toEqual([]);
});
for(const width of [390,1440])test(`A lost phone can be recovered with the final backup without consuming it on ordinary login at ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:844});const c=await fixture(context,true,false);c.lastBackup=true;await page.goto('/admin');await page.getByLabel('Adresse e-mail',{exact:true}).fill('owner@example.invalid');await page.getByLabel('Mot de passe',{exact:true}).fill('Fixture-Password');await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.getByRole('button',{name:'Utiliser un code de secours',exact:true}).click();const input=page.getByLabel('Code de secours',{exact:true});await input.fill(recoveryCodes[0]);await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.locator('.admin-login-card [role=alert]')).toContainText('dernier code');await expect(input).toHaveValue(recoveryCodes[0]);expect(c.recoveries).toBe(0);
 await page.getByRole('button',{name:'J’ai perdu mon téléphone',exact:true}).click();const reset=page.getByRole('button',{name:'Réinitialiser ma protection',exact:true});await expect(reset).toBeDisabled();await page.getByRole('checkbox').check();await reset.click();await expect(page.getByRole('status')).toContainText('Votre protection a été réinitialisée');await expect(page.locator('.admin-workspace')).toHaveCount(0);expect(c.recoveries).toBe(1);expect(c.enabled).toBe(false);await page.getByLabel('Mot de passe',{exact:true}).fill('Fixture-Password');await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.locator('.admin-workspace')).toBeVisible();expect(c.businessWrites).toEqual([]);
});
