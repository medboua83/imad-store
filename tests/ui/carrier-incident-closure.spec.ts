import { test, expect } from '@playwright/test';
const id='77777777777777777777c123',fingerprint='a'.repeat(64);
const labels={fr:{open:'Clôturer l’incident sans mouvement de stock',reason:'Motif de clôture (obligatoire)',submit:'Confirmer la clôture',closed:'Incident clôturé sans mouvement de stock',history:'Historique des clôtures',payment:'En attente de paiement'},ar:{open:'إغلاق المشكلة دون تغيير المخزون',reason:'سبب الإغلاق (إلزامي)',submit:'تأكيد الإغلاق',closed:'تم إغلاق المشكلة دون تغيير المخزون',history:'سجل إغلاق المشكلات',payment:'في انتظار الدفع'}};
function fixture(){return {id,customerName:'Client fictif',city:'Rabat',status:'CANCELLED',paymentMethod:'COD',paymentStatus:'PENDING',totalAmount:230,shippingCost:40,createdAt:'2026-11-21T10:00:00Z',items:[],shipment:{id,trackingId:'OL-ISOLATED',carrierStatus:'DELETED',state:'ATTENTION',lastError:'Contrôle physique du stock requis',lastSyncedAt:'2026-11-26T10:00:00Z',incidentFingerprint:fingerprint,incidentClosure:null as any,incidentHistoryCount:0}};}
for(const width of [390,1440])for(const locale of ['fr','ar'] as const){
 test(`Close an incident with required reason, history and no payment/stock action at ${width}px ${locale}`,async({page},info)=>{
  const l=labels[locale],order=fixture();await page.setViewportSize({width,height:1000});
  await page.addInitScript(locale=>{localStorage.setItem('adminToken','isolated-incident');localStorage.setItem('imad-admin-language',locale)},locale);
  let calls=0,release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);const writes:any[]=[];let closure:any;
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(route.request().method()!=='GET'){
    writes.push({path,body:route.request().postDataJSON()});if(path!==`/api/orders/${id}/carrier-incident-close`)return route.fulfill({status:405});
    calls++;await gate;const body=route.request().postDataJSON();closure={id:'c'.repeat(24),orderId:id,fingerprint,trackingId:'OL-ISOLATED',carrierStatus:'DELETED',reason:body.reason,closedById:'d'.repeat(24),closedByName:'Test opérateur',closedAt:'2026-11-26T12:00:00Z'};order.shipment.incidentClosure=closure;order.shipment.incidentHistoryCount=1;
    return route.fulfill({json:{success:true,data:{orderId:id,closure,created:true}}});
   }
   if(path===`/api/orders/${id}/carrier-incident-history`)return route.fulfill({json:{success:true,data:{items:[closure],nextCursor:null}}});
   if(path===`/api/orders/${id}/admin-details`)return route.fulfill({json:{success:true,data:order}});
   const data=path==='/api/orders'?[order]:[];return route.fulfill({json:{success:true,data,total:data.length,scopeTotal:data.length,statusCounts:{PENDING:0,CONFIRMED:0,SHIPPED:0,DELIVERED:0,CANCELLED:data.length},page:1,totalPages:1,unread:0}});
  });
  await page.goto('/admin?tab=orders');await page.getByRole('button',{name:locale==='fr'?/Voir les détails/:/عرض التفاصيل/}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:l.open,exact:true}).click();const reason=dialog.getByLabel(l.reason,{exact:true}),submit=dialog.locator('.carrier-incident-form button[type="submit"]');
  await expect(reason).toBeFocused();await expect(submit).toBeDisabled();await reason.fill('          ');await expect(submit).toBeDisabled();
  const note='Contrôle documenté <b>sans mouvement</b> — aucune réintégration automatique.';await reason.fill('  '+note+'  ');await submit.dblclick();await expect.poll(()=>calls).toBe(1);await expect(submit).toBeDisabled();release();
  await expect(dialog.getByText(l.closed,{exact:true})).toBeVisible();await expect(dialog.getByText(l.payment,{exact:true})).toBeVisible();
  await dialog.getByText(l.history,{exact:true}).click();await expect(dialog.getByText(note,{exact:true})).toBeVisible();await expect(dialog.getByText('Test opérateur',{exact:false})).toBeVisible();
  await expect(dialog.locator('.carrier-incident-reason b')).toHaveCount(0);expect(writes).toEqual([{path:`/api/orders/${id}/carrier-incident-close`,body:{fingerprint,reason:note}}]);
  expect(order.paymentStatus).toBe('PENDING');expect(order.status).toBe('CANCELLED');expect(order.shipment.state).toBe('ATTENTION');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`closure-${locale}-${width}.png`),fullPage:true});
 });
}

test('A failed save keeps the reason; a changed incident disables stale submission',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('adminToken','isolated-incident-failure'));const order=fixture();let writes=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;if(route.request().method()!=='GET'){writes++;return route.fulfill({status:503,json:{error:'Clôture temporairement indisponible'}})}
  const data=path==='/api/orders'?[order]:[];return route.fulfill({json:{success:true,data,total:data.length,page:1,totalPages:1,unread:0}});
 });
 await page.goto('/admin?tab=orders');await page.getByRole('button',{name:/Voir les détails/}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:labels.fr.open,exact:true}).click();
 const reason=dialog.getByLabel(labels.fr.reason,{exact:true});await reason.fill('Note conservée après une panne réseau.');await dialog.getByRole('button',{name:labels.fr.submit,exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Clôture temporairement indisponible');await expect(reason).toHaveValue('Note conservée après une panne réseau.');
 order.shipment.incidentFingerprint='b'.repeat(64);order.shipment.carrierStatus='RETURNED';await dialog.getByRole('button',{name:'Actualiser cette fiche',exact:true}).click();await expect(dialog.getByText('Le suivi a changé. Fermez puis rouvrez le formulaire avant de continuer.',{exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:labels.fr.submit,exact:true})).toBeDisabled();await expect(reason).toHaveValue('Note conservée après une panne réseau.');expect(writes).toBe(1);
});

test('Read-only collaborators can see incident history but cannot close an incident',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('adminToken',JSON.stringify({id:'d'.repeat(24),role:'STAFF',permissions:['orders.read']})));const order=fixture();let writes=0;
 const closure={id:'c'.repeat(24),orderId:id,fingerprint,trackingId:'OL-ISOLATED',carrierStatus:'DELETED',reason:'Contrôle précédent visible au lecteur autorisé.',closedById:'d'.repeat(24),closedByName:'Test opérateur',closedAt:'2026-11-26T12:00:00Z'};order.shipment.incidentClosure=closure;order.shipment.incidentHistoryCount=1;
 await page.route('**/api/**',async route=>{if(route.request().method()!=='GET'){writes++;return route.fulfill({status:405})}const path=new URL(route.request().url()).pathname;if(path===`/api/orders/${id}/carrier-incident-history`)return route.fulfill({json:{success:true,data:{items:[closure],nextCursor:null}}});const data=path==='/api/orders'?[order]:[];return route.fulfill({json:{success:true,data,total:data.length,page:1,totalPages:1,unread:0}})});
 await page.goto('/admin?tab=orders');await page.getByRole('button',{name:/Voir les détails/}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:labels.fr.open,exact:true})).toHaveCount(0);await dialog.getByText(labels.fr.history,{exact:true}).click();await expect(dialog.getByText(closure.reason,{exact:true})).toBeVisible();expect(writes).toBe(0);
});
