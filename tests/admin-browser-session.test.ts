import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express from "express";
import request from "supertest";
import { setAdminCookies } from "../backend/src/lib/admin-cookies";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const name = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(name);
process.env.SITE_URL = "http://localhost:3000";
process.env.IMAD_AUTH_MAIL_WORKER_DISABLED = "true";
let p: any, app: any, owner: any, reader: any;
const pwd = "Fictitious-cookie-session-2026";
const mode = { Origin: "http://localhost:3000", "X-Imad-Admin-Session": "cookie" };
const identity = (u: any) => ({ ...mode, "X-Imad-Admin-Identity": u.id + ":" + u.authVersion });
const cookies = (r: any): string[] => r.headers['set-cookie'].map((c: string) => c.split(';')[0]);
const tokenOf = (c: string[], type: string) => c.find(v => v.startsWith('imad_admin_' + type + '='))!.split('=')[1];
const login = (u = owner) => request(app).post('/api/auth/login').set(mode).send({ email: u.email, password: pwd }).expect(200);
let commerce: string;
const snapshot = async () => JSON.stringify({ orders: await p.order.findMany({ orderBy: { id: 'asc' } }), products: await p.product.count(), stock: await p.productVariant.findMany(), parcels: await p.olivraisonShipment.count(), outbox: await p.deskcommOutbox.count() });
before(async () => {
 await createDatabase(name);
 ({ prisma: p } = await import('../backend/src/lib/prisma')); ({ app } = await import('../backend/src/app'));
 const passwordHash = await bcrypt.hash(pwd,10);
 owner = await p.user.create({ data: { email: 'cookie-owner@example.invalid', firstName: 'Fixture', lastName: 'Owner', role: 'ADMIN', passwordHash } });
 reader = await p.user.create({ data: { email: 'cookie-reader@example.invalid', firstName: 'Fixture', lastName: 'Reader', role: 'STAFF', permissions: ['orders.read'], passwordHash } });
 await p.order.create({ data: { id: 'aabbccddeeff001122334455', customerName: 'FICTIF', customerPhone: '+212600000099', city: 'Rabat', totalAmount: 230, shippingCost: 30, status: 'PENDING', paymentStatus: 'PENDING', paymentMethod: 'COD', inventoryReserved: false } });
 commerce = await snapshot();
});
after(async () => { if (p) { assert.equal(await snapshot(),commerce); await p.$disconnect(); } await dropDatabase(name); });

test('Browser login keeps both credentials out of JSON and binds private requests to a revocable session', async () => {
 const r = await login(), c = cookies(r);
 assert.deepEqual(Object.keys(r.body.data).sort(),['identity','mode']); assert.equal(r.body.data.mode,'cookie');
 assert.equal(r.body.data.identity.id,owner.id); assert.equal(r.body.data.identity.authVersion,0);
 assert.ok(r.headers['set-cookie'].every((v: string) => /HttpOnly/.test(v)&&/SameSite=Strict/.test(v)&&/Path=\//.test(v)));
 assert.match(r.headers['cache-control'],/no-store/);
 await request(app).get('/api/orders').set(identity(owner)).set('Cookie',c).expect(200);
 await request(app).get('/api/auth/session').set(mode).set('Cookie',c).expect(200);
 await request(app).get('/api/orders').set('Cookie',c).expect(403);
 await request(app).get('/api/orders').set(identity(owner)).set('Authorization','Bearer forged').set('Cookie',c).expect(401);
});

test('Production cookies are HTTPS-only host cookies; clearing and expiry use the same scope', async () => {
 const old = process.env.NODE_ENV;
 try {
  process.env.NODE_ENV='production';
  const tiny=express();tiny.get('/',(_req,res)=>{setAdminCookies(res,jwt.sign({id:owner.id},process.env.JWT_SECRET!,{expiresIn:'15m'}),'fixture-refresh',new Date(Date.now()+60000));res.send('ok');});
  const r=await request(tiny).get('/').expect(200);
  assert.ok(r.headers['set-cookie'].every((s: string)=>s.startsWith('__Host-imad_admin_')&&s.includes('Secure')&&s.includes('HttpOnly')&&s.includes('SameSite=Strict')&&!/Domain=/i.test(s)));
 } finally { if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old; }
});

test('Foreign, sibling-subdomain, null-origin and simple requests cannot read or log out a browser session', async () => {
 const c=cookies(await login());
 await request(app).post('/api/auth/login').set('Cookie',c).send({email:owner.email,password:pwd}).expect(403);
 for(const origin of ['https://attacker.example','http://sibling.localhost:3000','null']) {
  await request(app).post('/api/auth/logout').set({...mode,Origin:origin}).set('Cookie',c).send({}).expect(403);
  await request(app).get('/api/orders').set({...identity(owner),Origin:origin}).set('Cookie',c).expect(403);
 }
 await request(app).post('/api/auth/logout').set('Origin',mode.Origin).set('Cookie',c).send({}).expect(403);
 await request(app).post('/api/auth/logout').set({'X-Imad-Admin-Session':'cookie'}).set('Cookie',c).send({}).expect(403);
 await request(app).get('/api/orders').set(identity(owner)).set('Sec-Fetch-Site','cross-site').set('Cookie',c).expect(403);
 await request(app).get('/api/orders').set({'X-Imad-Admin-Session':'cookie','X-Imad-Admin-Identity':owner.id+':0',Referer:mode.Origin+'/admin'}).set('Cookie',c).expect(200);
 await request(app).post('/api/auth/refresh').set('Cookie',c).send({token:tokenOf(c,'refresh')}).expect(403);
});

test('Logout immediately revokes replayed access credentials while another device remains connected', async () => {
 const c=cookies(await login()), other=cookies(await login());
 const r=await request(app).post('/api/auth/logout').set(mode).set('Cookie',c).send({}).expect(200);
 assert.ok(r.headers['set-cookie'].every((s: string)=>/Expires=Thu, 01 Jan 1970/.test(s)&&/HttpOnly/.test(s)));
 await request(app).get('/api/orders').set(identity(owner)).set('Cookie',c).expect(401);
 await request(app).get('/api/orders').set('Authorization','Bearer '+tokenOf(c,'access')).expect(401);
 await request(app).post('/api/auth/refresh').set(mode).set('Cookie',c).send({}).expect(401);
 await request(app).get('/api/orders').set(identity(owner)).set('Cookie',other).expect(200);
});

test('Parallel refreshes share one absolute-expiry session, do not expose credentials or create more sessions', async () => {
 const c=cookies(await login()), payload=jwt.decode(tokenOf(c,'refresh')) as jwt.JwtPayload;
 const before=await p.refreshToken.findUnique({where:{id:payload.sid}}), count=await p.refreshToken.count();
 const responses=await Promise.all(Array.from({length:6},()=>request(app).post('/api/auth/refresh').set(mode).set('Cookie',c).send({}).expect(200)));
 for(const r of responses) {
  assert.equal(r.body.data.identity.id,owner.id);assert.equal(r.body.data.accessToken,undefined);
  assert.equal(tokenOf(cookies(r),'refresh'),tokenOf(c,'refresh'));
  await request(app).get('/api/orders').set(identity(owner)).set('Cookie',cookies(r)).expect(200);
 }
 assert.equal(await p.refreshToken.count(),count);
 assert.equal((await p.refreshToken.findUnique({where:{id:payload.sid}})).expiresAt.toISOString(),before.expiresAt.toISOString());
 await p.refreshToken.update({where:{id:payload.sid},data:{expiresAt:new Date(Date.now()-1000)}});
 await request(app).get('/api/orders').set(identity(owner)).set('Cookie',c).expect(401);
 await request(app).post('/api/auth/refresh').set(mode).set('Cookie',c).send({}).expect(401);
});

test('The one-time legacy exchange consumes its refresh credential without changing the display identity', async () => {
 const old=await request(app).post('/api/auth/login').send({email:owner.email,password:pwd}).expect(200);
 assert.ok(old.body.data.accessToken&&old.body.data.refreshToken);
 const r=await request(app).post('/api/auth/session/migrate').set(mode).send({token:old.body.data.refreshToken}).expect(200);
 assert.equal(r.body.data.identity.id,owner.id);assert.equal(r.body.data.identity.role,'ADMIN');assert.equal(r.body.data.accessToken,undefined);
 await request(app).get('/api/orders').set(identity(owner)).set('Cookie',cookies(r)).expect(200);
 await request(app).post('/api/auth/refresh').send({token:old.body.data.refreshToken}).expect(401);
 await request(app).post('/api/auth/session/migrate').set(mode).send({token:old.body.data.refreshToken}).expect(401);
});

test('Stored permissions and browser identity binding reject stale or different-account actions before any business write', async () => {
 const c=cookies(await login(reader));
 await request(app).get('/api/orders').set(identity(reader)).set('Cookie',c).expect(200);
 await request(app).get('/api/team').set(identity(reader)).set('Cookie',c).expect(403);
 await request(app).patch('/api/orders/aabbccddeeff001122334455/status').set(identity(reader)).set('Cookie',c).send({status:'CONFIRMED'}).expect(403);
 const mismatch=await request(app).patch('/api/orders/aabbccddeeff001122334455/status').set(identity(owner)).set('Cookie',c).send({status:'CONFIRMED'}).expect(409);
 assert.equal(mismatch.body.code,'SESSION_CHANGED');assert.equal(await snapshot(),commerce);
 await p.user.update({where:{id:reader.id},data:{authVersion:{increment:1},permissions:[]}});
 await request(app).get('/api/orders').set(identity(reader)).set('Cookie',c).expect(401);
 await request(app).post('/api/auth/refresh').set(mode).set('Cookie',c).send({}).expect(401);
});

test('Changing the password clears cookies and revokes all existing sessions without changing commerce', async () => {
 const c=cookies(await login()),other=cookies(await login());
 const r=await request(app).post('/api/auth/change-password').set(identity(owner)).set('Cookie',c).send({currentPassword:pwd,password:pwd+'-new'}).expect(200);
 assert.ok(r.headers['set-cookie'].every((s:string)=>/Expires=Thu, 01 Jan 1970/.test(s)));
 for(const old of [c,other]) {
  await request(app).get('/api/orders').set(identity(owner)).set('Cookie',old).expect(401);
  await request(app).post('/api/auth/refresh').set(mode).set('Cookie',old).send({}).expect(401);
 }
 assert.equal(await snapshot(),commerce);
});
