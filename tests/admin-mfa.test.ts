import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Secret } from "otpauth";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const name = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(name);
process.env.SITE_URL = "http://localhost:3000";
process.env.IMAD_AUTH_MAIL_WORKER_DISABLED = "true";
let p: any, app: any, mfa: typeof import("../backend/src/lib/admin-mfa"), hash: string, commerce: string;
const pwd = "Fictitious-Mfa-Password-2026";
let sequence = 0;
const mode = { Origin: "http://localhost:3000", "X-Imad-Admin-Session": "cookie" };
const ip = () => ({ "X-Forwarded-For": "192.0.2." + (++sequence % 250 + 1) });
const access = (u: any) => jwt.sign({ id: u.id, email: u.email, role: u.role, sv: u.authVersion }, process.env.JWT_SECRET!);
const snapshot = async () => JSON.stringify({ orders: await p.order.findMany(), stock: await p.productVariant.findMany(), parcels: await p.olivraisonShipment.findMany(), outbox: await p.deskcommOutbox.count() });
async function account(role = "ADMIN") { return p.user.create({ data: { email: 'mfa-'+randomBytes(5).toString('hex')+'@example.invalid', firstName: 'Fixture', lastName: 'MFA', role, passwordHash: hash, permissions: role === 'STAFF' ? ['orders.read'] : [] } }); }
const setup = (u: any, body: any = {}) => request(app).post('/api/auth/mfa/setup').set(ip()).set('Authorization', 'Bearer '+access(u)).send({ currentPassword: pwd, ...body });
const confirm = (u: any, s: any, body: any = {}) => request(app).post('/api/auth/mfa/confirm').set(ip()).set('Authorization', 'Bearer '+access(u)).send({currentPassword:pwd,setupId:s.setupId,code:mfa.mfaTotp(s.secret).generate(),recoverySaved:true,...body});
const login = (u: any, code?: string, browser = true, password = pwd) => request(app).post('/api/auth/login').set(ip()).set(browser ? mode : {}).send({ email:u.email,password,...(code ? {code} : {}) });
async function enabled(role = 'ADMIN') { const u=await account(role), s=(await setup(u).expect(200)).body.data;await confirm(u,s).expect(200);const fresh=await p.user.findUnique({where:{id:u.id}});return {u:fresh,s,old:u}; }
before(async()=>{
 await createDatabase(name);({prisma:p}=await import('../backend/src/lib/prisma'));({app}=await import('../backend/src/app'));mfa=await import('../backend/src/lib/admin-mfa');app.set('trust proxy',1);
 hash=await bcrypt.hash(pwd,10);
 await p.order.create({data:{id:'aabbccddeeff001122334455',customerName:'FICTIF',customerPhone:'+212600000099',city:'Rabat',totalAmount:230,shippingCost:30,status:'PENDING',paymentStatus:'PENDING',paymentMethod:'COD',inventoryReserved:false}});commerce=await snapshot();
});
after(async()=>{if(p){assert.equal(await snapshot(),commerce);await p.$disconnect();}await dropDatabase(name);});

test('TOTP matches RFC6238 vectors, limits clock drift and refuses a consumed counter',()=>{
 const secret=Secret.fromUTF8('12345678901234567890').base32, t=mfa.mfaTotp(secret);
 for(const [seconds,expected] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037']] as const)assert.equal(t.generate({timestamp:seconds*1000}),expected);
 assert.equal(mfa.matchMfaStep(secret,'287082',null,59000),1n);assert.equal(mfa.matchMfaStep(secret,'287082',1n,59000),null);assert.equal(mfa.matchMfaStep(secret,'287082',null,120000),null);
});
test('Enrollment is opt-in, password protected, encrypted and exposes recovery codes only once',async()=>{
 const u=await account(),r=await request(app).get('/api/auth/mfa').set('Authorization','Bearer '+access(u)).expect(200);assert.equal(r.body.data.enabled,false);
 await setup(u,{currentPassword:'wrong'}).expect(400);assert.equal(await p.adminMfa.count({where:{userId:u.id}}),0);
 const s=(await setup(u).expect(200)).body.data;assert.match(s.qr,/^data:image\/png;base64,/);assert.equal(s.recoveryCodes.length,10);assert.equal(new Set(s.recoveryCodes).size,10);
 const stored=await p.adminMfa.findUnique({where:{userId:u.id}});assert.ok(!JSON.stringify(stored).includes(s.secret));assert.ok(s.recoveryCodes.every((c:string)=>!JSON.stringify(stored).includes(c)));
 assert.equal(mfa.openMfaSecret(u.id,stored.pendingCiphertext),s.secret);assert.throws(()=>mfa.openMfaSecret('b'.repeat(24),stored.pendingCiphertext));
 const view=await request(app).get('/api/auth/mfa').set('Authorization','Bearer '+access(u)).expect(200);assert.deepEqual(Object.keys(view.body.data).sort(),['enabled','enabledAt','recoveryCodesRemaining']);
 assert.equal((await login(u).expect(200)).body.data.mode,'cookie');
});
test('Unconfirmed, expired, cancelled and replaced configurations cannot enable MFA',async()=>{
 const u=await account(),s=(await setup(u).expect(200)).body.data;
 await confirm(u,s,{recoverySaved:false}).expect(400);await confirm(u,s,{code:'invalid'}).expect(400);
 await p.adminMfa.update({where:{userId:u.id},data:{pendingExpiresAt:new Date(Date.now()-1000)}});await confirm(u,s).expect(409);
 const s2=(await setup(u).expect(200)).body.data,s3=(await setup(u).expect(200)).body.data;await confirm(u,s2).expect(409);
 await request(app).post('/api/auth/mfa/cancel').set('Authorization','Bearer '+access(u)).send({setupId:s2.setupId}).expect(200);assert.equal((await p.adminMfa.findUnique({where:{userId:u.id}})).setupId,s3.setupId);
 await request(app).post('/api/auth/mfa/cancel').set('Authorization','Bearer '+access(u)).send({setupId:s3.setupId}).expect(200);await confirm(u,s3).expect(409);
 assert.equal((await p.user.findUnique({where:{id:u.id}})).authVersion,0);
});
test('Activation revokes browser and legacy sessions and never enables another account',async()=>{
 const u=await account(),other=await account(),before=await login(u).expect(200),s=(await setup(u).expect(200)).body.data;
 await confirm(other,s).expect(409);const r=await confirm(u,s).expect(200);assert.ok(r.headers['set-cookie'].every((s:string)=>s.includes('Expires=Thu, 01 Jan 1970')));
 assert.equal(await p.refreshToken.count({where:{userId:u.id}}),0);
 await request(app).get('/api/orders').set('Authorization','Bearer '+access(u)).expect(401);
 await request(app).get('/api/orders').set({...mode,'X-Imad-Admin-Identity':u.id+':0'}).set('Cookie',before.headers['set-cookie'].map((c:string)=>c.split(';')[0])).expect(401);
 assert.equal((await p.user.findUnique({where:{id:other.id}})).authVersion,0);assert.equal(await p.adminMfa.count({where:{userId:other.id}}),0);
});
test('Password alone cannot issue cookie or legacy credentials for an enabled account',async()=>{
 const {u,s}=await enabled();
 for(const browser of [true,false]){const r=await login(u,undefined,browser).expect(200);assert.deepEqual(r.body.data,{mfaRequired:true});assert.equal(r.headers['set-cookie'],undefined);}
 assert.equal(await p.refreshToken.count({where:{userId:u.id}}),0);
 await login(u,s.recoveryCodes[0],true,'incorrect-password').expect(401);
 assert.equal((await p.adminMfa.findUnique({where:{userId:u.id}})).recoveryHashes.length,10);
 await request(app).post('/api/auth/refresh').send({token:access(u)}).expect(401);
});
test('TOTP replay is rejected across simultaneous logins and both login transports',async()=>{
 const {u,s}=await enabled(),code=mfa.mfaTotp(s.secret).generate({timestamp:Date.now()+30000});
 const results=await Promise.all([login(u,code,true),login(u,code,false)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
 assert.equal(await p.refreshToken.count({where:{userId:u.id}}),1);
 await login(u,code).expect(400);
});
test('Recovery codes are single-use under concurrency, password bound and account bound',async()=>{
 const {u,s}=await enabled(),other=await enabled();
 await login(other.u,s.recoveryCodes[0]).expect(400);
 const rs=await Promise.all([login(u,s.recoveryCodes[0]),login(u,s.recoveryCodes[0])]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,400]);
 assert.equal((await p.adminMfa.findUnique({where:{userId:u.id}})).recoveryHashes.length,9);
 assert.ok(rs.find(r=>r.status===200).body.data.identity);assert.equal(await p.refreshToken.count({where:{userId:u.id}}),1);
 const legacy=await login(u,s.recoveryCodes[1],false).expect(200);assert.ok(legacy.body.data.accessToken);await request(app).get('/api/orders').set('Authorization','Bearer '+legacy.body.data.accessToken).expect(200);
});
test('Persistent per-account throttling holds across IPs and a later valid factor clears failed counters',async()=>{
 const {u,s}=await enabled();for(let i=0;i<4;i++)await login(u,'invalid').expect(400);await login(u,'invalid').expect(429);await login(u,s.recoveryCodes[0]).expect(429);
 const state=await p.adminMfa.findUnique({where:{userId:u.id}});assert.ok(state.lockedUntil>Date.now());
 await p.adminMfa.update({where:{userId:u.id},data:{lockedUntil:new Date(Date.now()-1000)}});
 await login(u,s.recoveryCodes[0]).expect(200);const fresh=await p.adminMfa.findUnique({where:{userId:u.id}});assert.equal(fresh.failedAttempts,0);assert.equal(fresh.lockedUntil,null);
});
test('Staff can protect only their own account; customers, foreign origins and anonymous requests are rejected',async()=>{
 const {u,s}=await enabled('STAFF'),customer=await account('CUSTOMER');await setup(customer).expect(403);
 await request(app).get('/api/auth/mfa').expect(401);
 const before=await p.adminMfa.findUnique({where:{userId:u.id}});
 for(const code of [s.recoveryCodes[0],'invalid'])await request(app).post('/api/auth/login').set({...mode,...ip(),Origin:'https://foreign.example'}).send({email:u.email,password:pwd,code}).expect(403);
 const unchanged=await p.adminMfa.findUnique({where:{userId:u.id}});assert.deepEqual(unchanged.recoveryHashes,before.recoveryHashes);assert.equal(unchanged.failedAttempts,before.failedAttempts);assert.equal(unchanged.lastUsedStep,before.lastUsedStep);
 const r=await login(u,s.recoveryCodes[0]).expect(200),c=r.headers['set-cookie'].map((c:string)=>c.split(';')[0]);
 await request(app).post('/api/auth/mfa/disable').set({...mode,Origin:'https://foreign.example','X-Imad-Admin-Identity':u.id+':'+u.authVersion}).set('Cookie',c).send({currentPassword:pwd,code:s.recoveryCodes[1]}).expect(403);
 await request(app).get('/api/team').set({...mode,'X-Imad-Admin-Identity':u.id+':'+u.authVersion}).set('Cookie',c).expect(403);
});
test('Disabling requires password and an unused factor, revokes all sessions and invalidates old backup codes',async()=>{
 const {u,s}=await enabled();await login(u,s.recoveryCodes[0]).expect(200);
 const disable=(body:any)=>request(app).post('/api/auth/mfa/disable').set(ip()).set('Authorization','Bearer '+access(u)).send(body);
 await disable({currentPassword:'wrong',code:s.recoveryCodes[1]}).expect(400);await disable({currentPassword:pwd,code:s.recoveryCodes[0]}).expect(400);
 await disable({currentPassword:pwd,code:s.recoveryCodes[1]}).expect(200);
 assert.equal(await p.refreshToken.count({where:{userId:u.id}}),0);assert.equal((await p.adminMfa.findUnique({where:{userId:u.id}})).secretCiphertext,null);
 await request(app).get('/api/orders').set('Authorization','Bearer '+access(u)).expect(401);
 const fresh=await p.user.findUnique({where:{id:u.id}});assert.equal((await login(fresh).expect(200)).body.data.mode,'cookie');
});
test('Password recovery changes the password but retains MFA and recovery-code requirements',async()=>{
 const {u,s}=await enabled(),token=randomBytes(32).toString('base64url'),{resetHash}=await import('../backend/src/lib/password-reset');
 await p.passwordReset.create({data:{tokenHash:resetHash(token),userId:u.id,authVersion:u.authVersion,expiresAt:new Date(Date.now()+60000)}});
 await request(app).post('/api/auth/reset-password').set(ip()).send({token,password:pwd+'-new'}).expect(200);
 assert.ok((await p.adminMfa.findUnique({where:{userId:u.id}})).enabledAt);
 const fresh=await p.user.findUnique({where:{id:u.id}});assert.deepEqual((await login(fresh,undefined,true,pwd+'-new').expect(200)).body.data,{mfaRequired:true});
 await login(fresh,s.recoveryCodes[0],true,pwd+'-new').expect(200);
});
