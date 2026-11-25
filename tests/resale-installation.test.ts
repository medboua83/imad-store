import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, chmod, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const db="imad_ci_"+randomBytes(8).toString("hex"), store=randomUUID();
process.env.DATABASE_URL=databaseUrl(db); process.env.STORE_INSTANCE_ID=store; process.env.STORE_SETUP_MODE="standalone";
process.env.STORE_DISPLAY_NAME="Atelier Démonstration"; delete process.env.CRM_COMPANY_ID;
let p:any, app:any, owner:any, reader:any, manager:any, receiptDir:string;
const auth=(u:any)=>({Authorization:"Bearer "+jwt.sign({id:u.id,role:u.role,sv:u.authVersion},process.env.JWT_SECRET!)});
before(async()=>{await createDatabase(db);({prisma:p}=await import("../backend/src/lib/prisma"));({app}=await import("../backend/src/app"));receiptDir=await mkdtemp(join(tmpdir(),"resale-receipt-"));});
after(async()=>{delete process.env.IMAD_OFFSITE_STATUS_FILE;await p?.$disconnect();await dropDatabase(db);await rm(receiptDir,{recursive:true,force:true});});
test("Fresh independent store binds without a CRM and first admin gets no IMAD contacts, trackers or commerce data",async()=>{
    const result=spawnSync(process.execPath,["--import","tsx","backend/scripts/provision-company-admin.ts"],{cwd:process.cwd(),env:{...process.env,BOOTSTRAP_ADMIN_EMAIL:"owner@example.invalid",BOOTSTRAP_ADMIN_PASSWORD:"fictional-bootstrap-only-12345"},encoding:"utf8"});
    assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stdout,/fictional-bootstrap/);
    owner=await p.user.findUniqueOrThrow({where:{email:"owner@example.invalid"}});
    const identity=await p.storeInstallation.findUniqueOrThrow({where:{id:"installation"}});assert.equal(identity.storeId,store);assert.equal(identity.companyId,null);
    const settings=(await request(app).get('/api/settings').expect(200)).body.data;
    assert.equal(settings.branding.name,'Atelier Démonstration');assert.equal(settings.directSiteConfirmation,true);
    for(const name of ['whatsappPhone','whatsappUrl','instagramUrl','facebookUrl','tiktokUrl'])assert.equal(settings[name],'',name);
    assert.equal(settings.metaPixelEnabled,false);assert.equal(settings.metaPixelId,null);
    for(const delegate of ['product','order','posSale','deskcommOutbox','deskcommConnection','olivraisonIntegration','gmailConfig'])assert.equal(await p[delegate].count(),0,delegate);
    const count=await p.user.count();const again=spawnSync(process.execPath,["--import","tsx","backend/scripts/provision-company-admin.ts"],{env:{...process.env,BOOTSTRAP_ADMIN_EMAIL:"other@example.invalid",BOOTSTRAP_ADMIN_PASSWORD:"fictional-bootstrap-only-12345"},encoding:"utf8"});assert.equal(again.status,1);assert.equal(await p.user.count(),count);
    reader=await p.user.create({data:{email:'reader@example.invalid',firstName:'Fixture',lastName:'Reader',passwordHash:'unused',role:'STAFF',permissions:['orders.read']}});
    manager=await p.user.create({data:{email:'manager@example.invalid',firstName:'Fixture',lastName:'Manager',passwordHash:'unused',role:'STAFF',permissions:['settings.manage']}});
});
test("Standalone identity refuses relabeling, missing profile, accidental CRM binding and all CRM enable calls",async()=>{
    const config=(await request(app).get('/api/integrations/deskcomm').set(auth(owner)).expect(200)).body.data;
    assert.equal(config.installation.mode,'standalone');assert.equal(config.connection,null);assert.equal(config.enabled,false);
    await request(app).put('/api/integrations/deskcomm').set(auth(owner)).send({enabled:true}).expect(409);
    await request(app).put('/api/integrations/deskcomm/connection').set(auth(owner)).send({enabled:true}).expect(409);
    process.env.CRM_COMPANY_ID=randomUUID();await request(app).get('/api/products').expect(503);delete process.env.CRM_COMPANY_ID;
    process.env.STORE_INSTANCE_ID=randomUUID();await request(app).get('/api/products').expect(503);process.env.STORE_INSTANCE_ID=store;
    delete process.env.STORE_SETUP_MODE;await request(app).get('/api/products').expect(503);process.env.STORE_SETUP_MODE='standalone';
    await request(app).get('/api/products').expect(200);
});
test("Readiness is private, permission checked and cannot mark empty policies, missing SMTP or MFA as complete",async()=>{
    const anonymous=await request(app).get('/api/settings/readiness').expect(401);assert.match(anonymous.headers['cache-control'],/no-store/);
    await request(app).get('/api/settings/readiness').set(auth(reader)).expect(403);
    await request(app).get('/api/settings/readiness?path=/etc/passwd').set(auth(owner)).expect(400);
    const result=await request(app).get('/api/settings/readiness').set(auth(owner)).expect(200);
    assert.match(result.headers['cache-control'],/private, no-store/);assert.equal(result.body.data.installationMode,'standalone');
    assert.equal(result.body.data.emailDeliveryVerified,false);
    for(const id of ['identity','policies','mail','mfa','backup'])assert.equal(result.body.data.checks.find((c:any)=>c.id===id).ready,false,id);
    const staff=await request(app).get('/api/settings/readiness').set(auth(manager)).expect(200);assert.equal(staff.body.data.checks.find((c:any)=>c.id==='mail').href,null);
    assert.doesNotMatch(JSON.stringify(result.body),/passwordHash|Ciphertext|JWT_SECRET|fictional-bootstrap|owner@example/);
});
test("Offsite health accepts only a fresh verified private receipt and never exposes filesystem paths or counts",async()=>{
    const file=join(receiptDir,'receipt.json');process.env.IMAD_OFFSITE_STATUS_FILE=file;
    const write=async(extra:any={})=>{await writeFile(file,JSON.stringify({completedAt:new Date().toISOString(),verified:true,encryptedSha256:'a'.repeat(64),tables:34,photos:2,...extra}),{mode:0o600});await chmod(file,0o600);};
    await write();let result=(await request(app).get('/api/operations/health').expect(200)).body;assert.equal(result.status,'ok');assert.equal(result.backupFresh,true);
    assert.doesNotMatch(JSON.stringify(result),/receipt.json|encryptedSha256|34|photos|tables|carrier:/);
    const baseline=await p.order.count();await write({completedAt:new Date(Date.now()-37*3600_000).toISOString()});result=(await request(app).get('/api/operations/health').expect(200)).body;assert.equal(result.status,'attention');assert.equal(result.backupFresh,false);
    await write({completedAt:new Date(Date.now()+3600_000).toISOString()});assert.equal((await request(app).get('/api/operations/health')).body.backupFresh,false);
    await write();await chmod(file,0o666);assert.equal((await request(app).get('/api/operations/health')).body.backupFresh,false);await chmod(file,0o600);
    const alias=join(receiptDir,'linked.json');await symlink(file,alias);process.env.IMAD_OFFSITE_STATUS_FILE=alias;assert.equal((await request(app).get('/api/operations/health')).body.backupFresh,false);process.env.IMAD_OFFSITE_STATUS_FILE=file;
    await write({unexpected:'private-value'});assert.equal((await request(app).get('/api/operations/health')).body.backupFresh,false);
    await write();assert.equal(await p.order.count(),baseline);
});
test("A standalone web order works without a CRM, repeats idempotently and preserves payment while cancellation releases stock",async()=>{
    const category=await p.category.create({data:{slug:'fixture-'+randomBytes(4).toString('hex'),nameFr:'Fixture',nameAr:'تجربة',nameEn:'Fixture'}});
    const product=await p.product.create({data:{slug:'article-fixture',nameFr:'Article fictif',nameAr:'منتج تجريبي',nameEn:'Fixture',descriptionFr:'',descriptionAr:'',descriptionEn:'',price:100,images:[],status:'ACTIVE',categoryId:category.id,variants:{create:{sku:'RESALE-FIXTURE-M',size:'M',color:'#000000',colorNameFr:'Noir',colorNameAr:'أسود',colorNameEn:'Black',stock:5}}},include:{variants:true}});
    const key=randomUUID(),body={confirmationMode:'SITE',paymentMethod:'COD',customer:{fullName:'Client fictif',phone:'+212600000099',street:'Adresse fictive',city:'Casablanca',region:'Casablanca-Settat'},items:[{productId:product.id,variantId:product.variants[0].id,quantity:1}]};
    const submit=()=>request(app).post('/api/orders').set('Idempotency-Key',key).send(body);
    const first=await submit();assert.equal(first.status,201,JSON.stringify(first.body));const again=await submit();assert.equal(again.status,200);assert.equal(again.body.data.id,first.body.data.id);
    assert.equal(await p.order.count(),1);assert.equal(await p.deskcommOutbox.count(),0);assert.equal(await p.olivraisonShipment.count(),0);
    const before=await p.order.findUniqueOrThrow({where:{id:first.body.data.id}});assert.equal(before.paymentStatus,'PENDING');assert.equal((await p.productVariant.findUnique({where:{id:product.variants[0].id}})).stock,4);
    await request(app).patch('/api/orders/'+before.id+'/status').set(auth(owner)).send({status:'CANCELLED'}).expect(200);
    const after=await p.order.findUniqueOrThrow({where:{id:before.id}});assert.equal(after.paymentStatus,before.paymentStatus);assert.equal(after.totalAmount,before.totalAmount);assert.equal((await p.productVariant.findUnique({where:{id:product.variants[0].id}})).stock,5);
});
test("A copied POS-only database cannot be claimed as a new standalone store",async()=>{
    const other='imad_ci_'+randomBytes(8).toString('hex');await createDatabase(other);
    try {
        const script=`(async()=>{const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();try{await p.posSale.create({data:{idempotencyKey:'fixture-copy',requestFingerprint:'fixture',cashierId:'fixture',cashierName:'Fixture',paymentMethod:'CASH',totalCents:100,savingsCents:0,receivedCents:100,changeCents:0}});const {assertStoreInstallation}=require('./backend/dist/lib/store-installation.js');try{await assertStoreInstallation();process.exitCode=1;}catch{if(await p.storeInstallation.count())process.exitCode=2;else console.log('COPY_REJECTED');}}finally{await p.$disconnect()}})().catch(()=>process.exitCode=3)`;
        const result=spawnSync(process.execPath,['-e',script],{env:{...process.env,DATABASE_URL:databaseUrl(other),STORE_INSTANCE_ID:randomUUID()},encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/COPY_REJECTED/);
    } finally { await dropDatabase(other); }
});
