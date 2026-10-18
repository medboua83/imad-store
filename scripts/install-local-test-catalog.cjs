/** Explicit local-only fixture installer; never imported by application startup. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
const catalog = require('../catalogue/local-test/products.json');
async function main() {
  assert.equal(catalog.kind, 'synthetic-local-test');
  assert.equal(catalog.products.length, 3);
  const slugs = new Set(), skus = new Set();
  for (const p of catalog.products) {
    assert(p.slug.startsWith('catalogue-essai-') && !slugs.has(p.slug)); slugs.add(p.slug);
    assert(p.nameFr.startsWith('[TEST]') && p.nameAr.startsWith('[اختبار]'));
    assert(p.price > 0 && p.variants.length > 0);
    for (const image of p.images) {
      assert(/^\/images\/catalogue-test\/[a-z]+\.webp$/.test(image));
      assert(fs.statSync(path.join(root, 'apps/web/public', image)).size < 250000);
    }
    for (const v of p.variants) {
      assert(Number.isInteger(v.stock) && v.stock >= 0 && !skus.has(v.sku)); skus.add(v.sku);
    }
  }
  if (!process.argv.includes('--apply-local-test')) {
    console.log('Validated 3 synthetic products, 5 variants, 3 images. Dry run: no database connection.'); return;
  }
  const url = new URL(process.env.DATABASE_URL || 'mongodb://invalid');
  assert(process.env.NODE_ENV !== 'production');
  assert(['localhost','127.0.0.1'].includes(url.hostname) && url.port === '27017');
  assert.equal(url.pathname, '/imad_store_test');
  assert(!url.username && !url.password);
  assert.equal(process.env.ALLOW_LOCAL_TEST_CATALOG, 'explicitly-authorized');
  const reportArg = process.argv.find(a => a.startsWith('--report='));
  assert(reportArg, 'An absolute, non-repository report path is required');
  const report = reportArg.slice(9);
  assert(path.isAbsolute(report) && !report.startsWith(root + path.sep));
  const db = new PrismaClient();
  try {
    const existing = await db.product.findMany({where:{slug:{in:[...slugs]}},include:{variants:true}});
    assert.equal(existing.length, 0, 'Already installed or conflicting slugs: refuse to overwrite/reset stock');
    const categories = await db.category.findMany({where:{slug:{in:catalog.products.map(p=>p.category)}}});
    for(const p of catalog.products) assert(categories.some(c=>c.slug===p.category),'Missing category '+p.category);
    const before = {productCount:await db.product.count(),orderCount:await db.order.count(),
      matchingProducts:existing,createdSlugs:[...slugs],createdAt:new Date().toISOString()};
    fs.writeFileSync(report, JSON.stringify(before,null,2), {flag:'wx',mode:0o600});
    await db.$transaction(async tx => {
      for(const entry of catalog.products) {
        const {category,variants,...p}=entry;
        await tx.product.create({data:{...p,status:'ACTIVE',categoryId:categories.find(c=>c.slug===category).id,variants:{create:variants}}});
      }
    });
    console.log('Installed 3 clearly labelled test products. No existing records changed; no order or CRM event created. Backup:',report);
  } finally {await db.$disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
