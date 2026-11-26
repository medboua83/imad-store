import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { orderTrackingMatches } from '@imad-store/shared';
const { databaseUrl, createDatabase, dropDatabase } = require('../scripts/test-postgres.cjs');
const name='imad_ci_'+randomBytes(8).toString('hex');
process.env.DATABASE_URL=databaseUrl(name);
process.env.DESKCOMM_OUTBOX_WORKER_ENABLED='false';
process.env.IMAD_AUTH_MAIL_WORKER_DISABLED='true';
let p:any,app:any,owner:any,reader:any,writer:any,writeOnly:any,settings:any,hash:any,worker:any,count:any;
const realFetch=globalThis.fetch;let externalCalls=0;
const reason='Contrôle isolé documenté ; aucun mouvement de stock demandé.';
const auth=(u:any)=>({Authorization:'Bearer '+jwt.sign({id:u.id,role:u.role,sv:u.authVersion},process.env.JWT_SECRET!)});
const endpoint=(id:string)=>`/api/orders/${id}/carrier-incident-close`;
async function fixture(extra:any={}){
 const order=await p.order.create({data:{status:'CANCELLED',paymentMethod:'COD',paymentStatus:'PENDING',totalAmount:230,shippingCost:40,inventoryReserved:true,customerName:'FICTITIOUS TEST',customerPhone:'+212600000000',city:'Test city',street:'Isolated fixture',...extra}});
 const shipment=await p.olivraisonShipment.create({data:{id:order.id,trackingId:'TEST-'+order.id,state:'ATTENTION',carrierStatus:'DELETED',lastError:'Physical stock remains unverified',nextAttemptAt:new Date(0),lockedUntil:new Date(0)}});
 return {order,shipment,fingerprint:hash(shipment)};
}
async function protectedRows(){return JSON.stringify({orders:await p.order.findMany({orderBy:{id:'asc'}}),stock:await p.productVariant.findMany({orderBy:{id:'asc'}}),shipments:await p.olivraisonShipment.findMany({orderBy:{id:'asc'}}),outbox:await p.deskcommOutbox.findMany({orderBy:{id:'asc'}})});}
async function details(id:string){return (await request(app).get(`/api/orders/${id}/admin-details`).set(auth(owner)).expect(200)).body.data;}
before(async()=>{
 await createDatabase(name);globalThis.fetch=(async()=>{externalCalls++;throw new Error('External calls forbidden in closure tests')}) as typeof fetch;
 ({prisma:p}=await import('../backend/src/lib/prisma'));({app}=await import('../backend/src/app'));
 ({carrierIncidentFingerprint:hash,readOpenCarrierIncidentCount:count}=await import('../backend/src/lib/carrier-incident-closure'));
 ({processOlivraisonQueue:worker}=await import('../backend/src/lib/olivraison'));
 const user=(email:string,role:string,permissions:string[])=>p.user.create({data:{email,passwordHash:'fixture-no-login',firstName:'Test',lastName:email.split('@')[0],role,permissions}});
 owner=await user('owner@example.invalid','ADMIN',[]);reader=await user('reader@example.invalid','STAFF',['orders.read']);writer=await user('writer@example.invalid','STAFF',['orders.read','orders.write']);writeOnly=await user('writeonly@example.invalid','STAFF',['orders.write']);settings=await user('settings@example.invalid','STAFF',['settings.manage']);
 const category=await p.category.create({data:{slug:'incident-fixture',nameFr:'TEST',nameAr:'اختبار',nameEn:'TEST'}});
 const product=await p.product.create({data:{slug:'incident-fixture',categoryId:category.id,nameFr:'TEST',nameAr:'اختبار',nameEn:'TEST',descriptionFr:'',descriptionAr:'',descriptionEn:'',price:200,images:[],status:'ACTIVE'}});
 await p.productVariant.create({data:{productId:product.id,sku:'INCIDENT-TEST',stock:17,color:'#000000',colorNameFr:'Noir',colorNameAr:'أسود',colorNameEn:'Black'}});
});
after(async()=>{globalThis.fetch=realFetch;await p?.$disconnect();await dropDatabase(name);assert.equal(externalCalls,0)});

test('Closure requires order-write access, a meaningful reason and the exact observed incident; request cannot change payment, actor or stock',async()=>{
 const f=await fixture(),body={fingerprint:f.fingerprint,reason};const before=await protectedRows();
 await request(app).post(endpoint(f.order.id)).send(body).expect(401);
 for(const user of [reader,writeOnly,settings])await request(app).post(endpoint(f.order.id)).set(auth(user)).send(body).expect(403);
 for(const invalid of [{fingerprint:f.fingerprint},{...body,reason:'          '},{...body,reason:'short'},{...body,reason:'x'.repeat(1001)},{...body,reason:'invalid\u0000reason text'},{...body,paymentStatus:'PAID'},{...body,inventoryReserved:false},{...body,closedById:reader.id},{...body,fingerprint:'injected'}])
  await request(app).post(endpoint(f.order.id)).set(auth(owner)).send(invalid).expect(400);
 assert.equal(await p.carrierIncidentClosure.count(),0);assert.equal(await protectedRows(),before);
});

test('A closure writes only its audit row, retains payment/reservation/stock/parcel state, and is visible privately with who/when/reason',async()=>{
 for(const paymentStatus of ['PENDING','PAID','FAILED','REFUNDED']){
  const f=await fixture({paymentStatus}),body={fingerprint:f.fingerprint,reason};const before=await protectedRows(),open=await count();
  const saved=await request(app).post(endpoint(f.order.id)).set(auth(writer)).send(body).expect(200);
  assert.equal(saved.body.data.created,true);assert.equal(saved.body.data.closure.closedById,writer.id);assert.equal(saved.body.data.closure.closedByName,'Test writer');assert.equal(saved.body.data.closure.reason,reason);assert(Number.isFinite(Date.parse(saved.body.data.closure.closedAt)));assert.match(saved.headers['cache-control'],/no-store/);
  const replay=await request(app).post(endpoint(f.order.id)).set(auth(writer)).send(body).expect(200);
  assert.equal(replay.body.data.created,false);assert.equal(replay.body.data.closure.id,saved.body.data.closure.id);
  assert.equal(await p.carrierIncidentClosure.count({where:{orderId:f.order.id}}),1);assert.equal(await protectedRows(),before);assert.equal(await count(),open-1);
  const row=await details(f.order.id);assert.equal(row.shipment.state,'ATTENTION');assert.equal(row.shipment.incidentHistory[0].reason,reason);assert.equal(orderTrackingMatches(row.shipment,'ATTENTION'),false);
  const filtered=await request(app).get('/api/orders').query({search:f.order.id,tracking:'ATTENTION'}).set(auth(reader)).expect(200);assert.equal(filtered.body.total,0);
  const all=await request(app).get('/api/orders').query({search:f.order.id}).set(auth(reader)).expect(200);assert.equal(all.body.total,1);
  const csv=await request(app).get('/api/orders/export.csv').query({search:f.order.id,tracking:'ATTENTION'}).set(auth(owner)).expect(200);assert.equal(csv.headers['x-order-export-count'],'0');
  await request(app).post(`/api/integrations/olivraison/shipments/${f.order.id}/retry`).set(auth(owner)).expect(409);assert.equal(await protectedRows(),before);
  const publicOrder=await request(app).get(`/api/orders/${f.order.id}`).expect(200);assert.equal(JSON.stringify(publicOrder.body).includes(reason),false);assert.equal(publicOrder.body.data.shipment,undefined);
 }
 const list=await request(app).get('/api/integrations/olivraison/shipments').set(auth(settings)).expect(200);assert.equal(JSON.stringify(list.body).includes(reason),false);assert(list.body.data.some((s:any)=>s.incidentClosure?.fingerprint));
});

test('Concurrent double clicks preserve one immutable closure and original actor identity',async()=>{
 const f=await fixture(),before=await protectedRows();
 const results=await Promise.all(Array.from({length:5},()=>request(app).post(endpoint(f.order.id)).set(auth(owner)).send({fingerprint:f.fingerprint,reason})));
 assert(results.every(r=>r.status===200));assert.equal(results.filter(r=>r.body.data.created).length,1);assert.equal(new Set(results.map(r=>r.body.data.closure.id)).size,1);
 await p.user.update({where:{id:owner.id},data:{lastName:'Renamed'}});
 const replay=await request(app).post(endpoint(f.order.id)).set(auth(owner)).send({fingerprint:f.fingerprint,reason:'A different later note must not replace the first.'}).expect(200);
 assert.equal(replay.body.data.closure.reason,reason);assert.equal(replay.body.data.closure.closedByName,'Test owner');assert.equal(await protectedRows(),before);
});

test('Changed tracking/status/error/state, an active lease, and a missing parcel cannot close the wrong incident',async()=>{
 for(const update of [{trackingId:'TEST-DIFFERENT'},{carrierStatus:'RETURNED'},{lastError:'A different incident requiring review'},{state:'DONE'}]){
  const f=await fixture();await p.olivraisonShipment.update({where:{id:f.order.id},data:update});const before=await protectedRows();
  await request(app).post(endpoint(f.order.id)).set(auth(owner)).send({fingerprint:f.fingerprint,reason}).expect(409);assert.equal(await p.carrierIncidentClosure.count({where:{orderId:f.order.id}}),0);assert.equal(await protectedRows(),before);
 }
 const f=await fixture();await p.olivraisonShipment.update({where:{id:f.order.id},data:{leaseToken:'fixture-lease',lockedUntil:new Date(Date.now()+60000)}});const before=await protectedRows();
 await request(app).post(endpoint(f.order.id)).set(auth(owner)).send({fingerprint:f.fingerprint,reason}).expect(409);assert.equal(await protectedRows(),before);
 await request(app).post(endpoint('f'.repeat(24))).set(auth(owner)).send({fingerprint:f.fingerprint,reason}).expect(404);
});

test('Closed in-transit returns keep GET-only tracking; changed incident reopens the alert while retaining prior history',async()=>{
 await p.olivraisonShipment.updateMany({data:{state:'DONE',lockedUntil:new Date(0),leaseToken:null}});
 await p.olivraisonIntegration.create({data:{id:'olivraison',enabled:true,activatedAt:new Date('2020-01-01'),credentials:'injected-test-only',autoPickup:true,pickupAddress:{}}});
 const f=await fixture({status:'SHIPPED'});await p.olivraisonShipment.update({where:{id:f.order.id},data:{carrierStatus:'RETURN_IN_TRANSIT'}});
 const start=await details(f.order.id);await request(app).post(endpoint(f.order.id)).set(auth(writer)).send({fingerprint:start.shipment.incidentFingerprint,reason}).expect(200);
 const financial=JSON.stringify({o:await p.order.findUnique({where:{id:f.order.id}}),stock:await p.productVariant.findMany()});let status='RETURN_IN_TRANSIT';const calls:string[]=[];
 const read=async(path:string,method='GET')=>{assert.equal(method,'GET');assert.equal(path,'/package/'+f.shipment.trackingId);calls.push(method+' '+path);return {trackingID:f.shipment.trackingId,status}};
 await worker(read);let row=await details(f.order.id);assert.equal(orderTrackingMatches(row.shipment,'ATTENTION'),false);assert.equal(row.shipment.incidentHistory.length,1);
 status='RETURNED';await p.olivraisonShipment.update({where:{id:f.order.id},data:{nextAttemptAt:new Date(0)}});await worker(read);
 row=await details(f.order.id);assert.equal(orderTrackingMatches(row.shipment,'ATTENTION'),true);assert.equal(row.shipment.incidentClosure,null);assert.equal(row.shipment.incidentHistory[0].reason,reason);
 assert.equal((await request(app).get('/api/orders').query({search:f.order.id,tracking:'ATTENTION'}).set(auth(owner)).expect(200)).body.total,1);
 assert.equal(JSON.stringify({o:await p.order.findUnique({where:{id:f.order.id}}),stock:await p.productVariant.findMany()}),financial);
 await request(app).post(endpoint(f.order.id)).set(auth(writer)).send({fingerprint:row.shipment.incidentFingerprint,reason:'Second distinct return incident reviewed separately.'}).expect(200);
 assert.equal((await details(f.order.id)).shipment.incidentHistory.length,2);assert.equal(calls.length,2);
});

test('Database constraints also prevent an empty reason and a duplicate acknowledgement',async()=>{
 const f=await fixture();const data={orderId:f.order.id,fingerprint:f.fingerprint,trackingId:f.shipment.trackingId,shipmentState:'ATTENTION',carrierStatus:f.shipment.carrierStatus,incidentError:f.shipment.lastError,incidentVersion:f.shipment.incidentVersion,closedById:owner.id,closedByName:'Fixture owner',reason};
 await assert.rejects(p.carrierIncidentClosure.create({data:{...data,reason:'   '}}));
 await p.carrierIncidentClosure.create({data});await assert.rejects(p.carrierIncidentClosure.create({data}));
 assert.equal(await p.carrierIncidentClosure.count({where:{orderId:f.order.id}}),1);
});

test('A status cycle back to the same incident reopens it; routine tracking timestamps do not',async()=>{
 const f=await fixture();await request(app).post(endpoint(f.order.id)).set(auth(owner)).send({fingerprint:f.fingerprint,reason}).expect(200);
 await p.olivraisonShipment.update({where:{id:f.order.id},data:{lastSyncedAt:new Date(),nextAttemptAt:new Date(),leaseToken:null,lockedUntil:new Date(0)}});
 let row=await details(f.order.id);assert.equal(row.shipment.incidentFingerprint,f.fingerprint);assert.equal(orderTrackingMatches(row.shipment,'ATTENTION'),false);
 await p.olivraisonShipment.update({where:{id:f.order.id},data:{carrierStatus:'RETURNED'}});
 await p.olivraisonShipment.update({where:{id:f.order.id},data:{carrierStatus:f.shipment.carrierStatus,lastError:f.shipment.lastError}});
 row=await details(f.order.id);assert.notEqual(row.shipment.incidentFingerprint,f.fingerprint);assert.equal(orderTrackingMatches(row.shipment,'ATTENTION'),true);
 await request(app).post(endpoint(f.order.id)).set(auth(owner)).send({fingerprint:f.fingerprint,reason}).expect(409);
 await request(app).post(endpoint(f.order.id)).set(auth(owner)).send({fingerprint:row.shipment.incidentFingerprint,reason}).expect(200);
 assert.equal(await p.carrierIncidentClosure.count({where:{orderId:f.order.id}}),2);
});

test('Closure history is private, fully paginated and scoped to its order',async()=>{
 const f=await fixture();
 await p.carrierIncidentClosure.createMany({data:Array.from({length:25},(_,i)=>({orderId:f.order.id,fingerprint:i.toString(16).padStart(64,'0'),trackingId:f.shipment.trackingId,shipmentState:'ATTENTION',carrierStatus:'DELETED',incidentVersion:i,reason:'Isolated historical control '+i,closedById:owner.id,closedByName:'Historical actor',closedAt:new Date(Date.UTC(2026,0,1,0,0,i))}))});
 await request(app).get(`/api/orders/${f.order.id}/carrier-incident-history`).expect(401);
 await request(app).get(`/api/orders/${f.order.id}/carrier-incident-history`).set(auth(settings)).expect(403);
 const first=(await request(app).get(`/api/orders/${f.order.id}/carrier-incident-history`).set(auth(reader)).expect(200)).body.data;assert.equal(first.items.length,20);assert(first.nextCursor);
 const second=(await request(app).get(`/api/orders/${f.order.id}/carrier-incident-history`).query({before:first.nextCursor}).set(auth(reader)).expect(200)).body.data;assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,25);
 const other=await fixture();await request(app).get(`/api/orders/${other.order.id}/carrier-incident-history`).query({before:first.nextCursor}).set(auth(reader)).expect(400);
});
