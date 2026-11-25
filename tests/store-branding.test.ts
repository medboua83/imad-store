import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { defaultStoreBranding, defaultSiteContent, brandTheme, brandForeground, resolveStoreBranding } from "../packages/shared/src";
import { storefrontShareMetadata, collectionShareMetadata, productShareMetadata } from "../apps/web/src/lib/share-metadata";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const db = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(db);
let p: any, app: any, owner: string, reader: string, settingsUser: string, original: string;
const auth = (token: string) => ({ Authorization: "Bearer " + token });
async function invariant() { return JSON.stringify({
    settings: await p.storeSettings.findMany(), content: await p.siteContent.findMany(),
    orders: await p.order.findMany(), stock: await p.productVariant.findMany(),
    parcels: await p.olivraisonShipment.findMany(), pos: await p.posSale.findMany(),
}); }
before(async () => {
    await createDatabase(db);
    ({ prisma: p } = await import("../backend/src/lib/prisma")); ({ app } = await import("../backend/src/app"));
    async function token(role: string, permissions: string[]) {
        const user = await p.user.create({ data: { email: randomBytes(6).toString("hex") + "@example.invalid", passwordHash: "unused", firstName: "Fixture", lastName: "Owner", role, permissions } });
        return jwt.sign({ id: user.id, role, sv: user.authVersion }, process.env.JWT_SECRET!);
    }
    owner = await token("ADMIN", []); reader = await token("STAFF", ["orders.read"]); settingsUser = await token("STAFF", ["settings.manage"]);
    await p.storeSettings.create({ data: { id: "settings", shippingCost: 40, metaPixelId: "314848944250050", metaPixelEnabled: true } });
    await p.siteContent.create({ data: { id: "site", draft: defaultSiteContent, published: { ...defaultSiteContent, businessAddress: "Adresse existante", policiesVerified: true } } });
    original = await invariant();
});
after(async () => { await p?.$disconnect(); await dropDatabase(db); });
test("Default identity preserves IMAD artwork, palette and public contact fallback", async () => {
    const r = await request(app).get('/api/settings/branding').set(auth(owner)).expect(200);
    assert.equal(r.headers['cache-control'], 'private, no-store');
    assert.deepEqual(r.body.data, { revision: 0, branding: { ...defaultStoreBranding, contactAddress: 'Adresse existante' } });
    assert.deepEqual(brandTheme(defaultStoreBranding), {});
    assert.equal(brandForeground('#ffffff'), '#171717'); assert.equal(brandForeground('#000000'), '#ffffff');
    assert.deepEqual(resolveStoreBranding({ primaryColor: 'url(javascript:1)', logoUrl: '//evil.invalid/x', name: '' }), defaultStoreBranding);
});
const changed = { ...defaultStoreBranding, name: 'Atelier Test', primaryColor: '#163c31', accentColor: '#f0d8a0', backgroundColor: '#fafafa', contactEmail: 'contact@example.invalid', contactPhone: '+212 600 000 099', contactAddress: 'Adresse fictive\nRabat' };
test("Private identity writes require current server permissions and strict public values", async () => {
    await request(app).get('/api/settings/branding').expect(401);
    await request(app).put('/api/settings/branding').set(auth(reader)).send({ revision: 0, branding: changed }).expect(403);
    for (const patch of [{ name: '' }, { name: '<script>x</script>' }, { contactEmail: 'a\r\nBcc: test' }, { contactPhone: 'javascript:alert(1)' }, { primaryColor: 'red; color:transparent' }, { logoUrl: 'https://example.invalid/logo.svg' }, { logoUrl: '/uploads/../../x.webp' }, { unknown: 'x' }]) {
        await request(app).put('/api/settings/branding').set(auth(owner)).send({ revision: 0, branding: { ...changed, ...patch } }).expect(400);
    }
    await request(app).put('/api/settings/branding').set(auth(owner)).send({ revision: 0, branding: { ...changed, logoUrl: '/uploads/' + 'b'.repeat(64) + '.webp' } }).expect(400);
    assert.equal(await p.storeBranding.count(), 0);
    assert.equal(await invariant(), original);
});
test("Saving identity is public, revision guarded and changes no commerce or other settings", async () => {
    const r = await request(app).put('/api/settings/branding').set(auth(settingsUser)).send({ revision: 0, branding: changed }).expect(200);
    assert.equal(r.body.data.revision, 1);
    assert.deepEqual((await request(app).get('/api/settings').expect(200)).body.data.branding, changed);
    await request(app).put('/api/settings/branding').set(auth(owner)).send({ revision: 0, branding: defaultStoreBranding }).expect(409);
    const concurrent = await Promise.all(['One', 'Two'].map(name => request(app).put('/api/settings/branding').set(auth(owner)).send({ revision: 1, branding: { ...changed, name } })));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    assert.equal((await p.storeBranding.findUnique({ where: { id: 'store' } })).revision, 2);
    assert.equal(await invariant(), original);
});
test("Settings collaborators can import a safe logo without catalogue permissions", async () => {
    const sharp = (await import('sharp')).default;
    const image = await sharp({ create: { width: 30, height: 12, channels: 4, background: '#ffffff00' } }).png().toBuffer();
    const r = await request(app).post('/api/uploads').set(auth(settingsUser)).set('Content-Type', 'image/png').send(image).expect(201);
    await request(app).put('/api/settings/branding').set(auth(owner)).send({ revision: 2, branding: { ...changed, logoUrl: r.body.data.url, darkLogoUrl: r.body.data.url } }).expect(200);
    await request(app).post('/api/uploads').set(auth(reader)).set('Content-Type', 'image/png').send(image).expect(403);
    await request(app).put('/api/settings/branding').set(auth(owner)).send({ revision: 3, branding: defaultStoreBranding }).expect(200);
    assert.deepEqual((await request(app).get('/api/settings')).body.data.branding, defaultStoreBranding);
    assert.equal(await invariant(), original);
});
test("Shared titles and product photo cards use the merchant name without replacing product photos", () => {
    const origin = new URL('https://example.invalid');
    const home = storefrontShareMetadata('home', origin, changed);
    assert.equal(home.openGraph?.siteName, changed.name);
    assert.deepEqual(home.title, { absolute: changed.name + ' — اختيارات على ذوقكم' });
    const product = productShareMetadata({ slug: 'fixture', nameFr: 'Fixture', images: ['/uploads/' + 'a'.repeat(64) + '.webp'] }, origin, changed);
    assert.equal(product.openGraph?.siteName, changed.name);
    assert.ok(JSON.stringify(product.openGraph?.images).includes('/uploads/'));
    assert.equal(collectionShareMetadata({slug:'fixture', nameAr:'Fixture'} as any, origin, changed).openGraph?.siteName, changed.name);
});
