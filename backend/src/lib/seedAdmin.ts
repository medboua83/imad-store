import { prisma } from "./prisma";

/** Never auto-create or reset admin credentials on startup. */
async function ensureAdminExists(): Promise<void> {
    const count = await prisma.user.count({ where: { role: "ADMIN" } });
    if (count === 0) console.warn("No admin account exists; provision with a restricted offline operation.");
}

const REAL_CATEGORIES = [
    { slug: "bags", nameAr: "الحقائب", nameFr: "Sacs", nameEn: "Bags" },
    { slug: "abayas", nameAr: "العبايات", nameFr: "Abayas", nameEn: "Abayas" },
    { slug: "shawls", nameAr: "شيلان", nameFr: "Châles", nameEn: "Shawls" },
    { slug: "womens-shoes", nameAr: "أحذية نسائية", nameFr: "Chaussures Femme", nameEn: "Women's Shoes" },
    { slug: "mens-clogs", nameAr: "صابو رجالي", nameFr: "Sabots Homme", nameEn: "Men's Clogs" }
];

/** Ensures at least one category + product exist so checkout never fails on empty DB. */
async function ensureSampleProducts(clean = false): Promise<void> {
    try {
        if (clean) {
            console.log("🧹 Clean flag provided. Deleting all products, variants, and categories...");
            await prisma.productVariant.deleteMany({});
            await prisma.product.deleteMany({});
            await prisma.category.deleteMany({});
            console.log("🧹 Cleanup complete.");
        } else {
            // Remove the legacy 'robes' category if it exists and has no products
            const robes = await prisma.category.findUnique({ where: { slug: "robes" }, include: { products: true } });
            if (robes && robes.products.length === 0) {
                await prisma.category.delete({ where: { id: robes.id } });
            }
        }

        console.log("⚙️  Seeding real store categories...");
        let firstCategoryId: string | null = null;

        for (const cat of REAL_CATEGORIES) {
            const created = await prisma.category.upsert({
                where: { slug: cat.slug },
                update: {},
                create: {
                    slug: cat.slug,
                    nameFr: cat.nameFr,
                    nameAr: cat.nameAr,
                    nameEn: cat.nameEn,
                    image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
                },
            });
            if (!firstCategoryId) firstCategoryId = created.id;
        }

        const productCount = await prisma.product.count();
        if (productCount > 0) {
            console.log(`✅ Products OK: ${productCount} product(s) in DB.`);
            return;
        }

        console.log("⚙️  No products found — seeding a demo product into the first category...");

        if (firstCategoryId) {
            const product = await prisma.product.create({
                data: {
                    slug: "demo-bag-sample",
                    nameFr: "Sac Élégant",
                    nameAr: "حقيبة أنيقة",
                    nameEn: "Elegant Bag",
                    descriptionFr: "Un sac élégant pour toutes les occasions.",
                    descriptionAr: "حقيبة أنيقة لجميع المناسبات.",
                    descriptionEn: "An elegant bag for all occasions.",
                    price: 299,
                    compareAtPrice: 399,
                    images: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
                    status: "ACTIVE",
                    categoryId: firstCategoryId,
                },
            });

            await prisma.productVariant.create({
                data: {
                    productId: product.id,
                    color: "#000000",
                    colorNameFr: "Noir",
                    colorNameAr: "أسود",
                    colorNameEn: "Black",
                    size: "Standard",
                    stock: 100,
                    sku: `${product.id}-BLK-STD`,
                },
            });
            console.log(`✅ Demo product seeded: ${product.slug}`);
        }
    } catch (err) {
        console.error("⚠️  ensureSampleProducts failed (non-fatal):", err);
    }
}

/** Ensures store settings exist */
async function ensureStoreSettings(): Promise<void> {
    try {
        await prisma.storeSettings.upsert({
            where: { id: "settings" },
            update: {},
            create: {
                id: "settings",
                whatsappPhone: "212660560522",
                shippingCost: 30,
                freeShippingMin: 500,
                codEnabled: true,
            },
        });
        console.log("✅ Store settings OK.");
    } catch (err) {
        console.error("⚠️  ensureStoreSettings failed (non-fatal):", err);
    }
}

/** Master seed function — runs on every boot. Fully idempotent. */
export async function ensureProductionData(clean = false): Promise<void> {
    console.log(`🌱 Running production data checks... (clean=${clean})`);
    await ensureAdminExists();
    await ensureSampleProducts(clean);
    await ensureStoreSettings();
    console.log("🌱 Production data checks complete.");
}

// Keep the old export name so nothing breaks
export { ensureAdminExists };
