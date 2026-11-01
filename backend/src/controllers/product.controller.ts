import { Request, Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { isAmbiguousSize, quantityDiscountError } from "@imad-store/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { objectIdSchema, paginationSchema, isPublishableImage } from "../lib/validation";
import { recommendationSettingsSchema, recommendationSettings, validateRecommendationTargets, recommendable } from "../lib/product-recommendations";

const variantSchema = z.object({
    id: objectIdSchema.optional(),
    expectedStock: z.number().int().min(0).optional(),
    color: z.string().max(80),
    colorNameFr: z.string().max(80),
    colorNameAr: z.string().max(80),
    colorNameEn: z.string().max(80),
    size: z.string().max(40).nullable().optional(),
    stock: z.number().int().min(0).max(1000000),
    sku: z.string().trim().min(1).max(100),
});
const slugSchema = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(160);
const productSchema = z.object({
    slug: slugSchema,
    nameFr: z.string().trim().min(1).max(200),
    nameAr: z.string().trim().min(1).max(200),
    nameEn: z.string().trim().min(1).max(200),
    descriptionFr: z.string().max(20000),
    descriptionAr: z.string().max(20000),
    descriptionEn: z.string().max(20000),
    price: z.number().positive().max(1000000),
    compareAtPrice: z.number().positive().max(1000000).nullable().optional(),
    quantityDiscounts: z.array(z.object({
        minQuantity: z.number().int().min(2).max(100),
        unitPrice: z.number().positive().max(1000000),
        totalPrice: z.number().positive().max(100000000).optional(),
    }).strict()).max(5).optional(),
    freeShipping: z.boolean().optional(),
    recommendationSettings: recommendationSettingsSchema.optional(),
    images: z
        .array(z.string().max(2000).refine(isPublishableImage, "Image non prise en charge"))
        .max(12),
    status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
    categoryId: objectIdSchema,
    variants: z.array(variantSchema).max(100),
});
export function isFixture(slug: string) {
    return slug.startsWith("test-19a-") || slug === "demo-bag-sample";
}
function assertPublishable(product: any) {
    const discountError = quantityDiscountError(product.price, product.quantityDiscounts);
    if (discountError) throw new AppError(discountError, 400);
    if (product.compareAtPrice != null && product.compareAtPrice <= product.price) throw new AppError("Le prix initial doit dépasser le prix promotionnel.", 400);
    if (product.status !== "ACTIVE") return;
    if (
        isFixture(product.slug) ||
        !product.images.length ||
        product.images.some(
            (url: string) => !isPublishableImage(url) || url.includes("cloudinary.com/demo/"),
        ) ||
        !product.nameFr?.trim() ||
        !product.nameAr?.trim() ||
        !product.nameEn?.trim() ||
        !product.variants.some((v: any) => v.stock > 0 && !isAmbiguousSize(v.size))
    ) {
        throw new AppError(
            "Pour publier : renseignez les noms, une vraie photo et au moins une variante en stock. Les fiches de démonstration doivent être remplacées.",
            400,
        );
    }
}
const include = { category: true, variants: true };
function publicProduct(product: any) {
    const { recommendationSettings: _settings, ...visible } = product;
    return { ...visible, variants: product.variants.filter((v: any) => !isAmbiguousSize(v.size)) };
}
function assertSizes(variants: any[], previous: any[] = []) {
    for (const variant of variants) {
        if (isAmbiguousSize(variant.size) && !previous.some((old) => old.id === variant.id && old.size === variant.size))
            throw new AppError("Une seule taille par variante. Créez une variante et un stock distincts pour chaque pointure.", 400);
    }
}
async function list(queryInput: unknown, admin: boolean) {
    const query = paginationSchema
        .extend({
            category: slugSchema.optional(),
            status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
            search: z.string().trim().max(120).optional(),
            size: z.string().max(40).refine(v => !isAmbiguousSize(v), "Une seule taille par filtre").optional(),
            includeFilters: z.enum(["0", "1"]).optional(),
            ids: z.string().max(199).transform(v => v.split(",")).pipe(z.array(objectIdSchema).min(1).max(8)).optional(),
            minPrice: z.coerce.number().min(0).max(1000000).optional(),
            maxPrice: z.coerce.number().min(0).max(1000000).optional(),
            availability: z.enum(["all", "in-stock"]).default("all"),
            sort: z.enum(["newest", "price-asc", "price-desc", "name"]).default("newest"),
        })
        .parse(queryInput);
    if (!admin && query.status && query.status !== "ACTIVE")
        throw new AppError("Accès refusé", 403);
    if (!admin && query.ids) throw new AppError("Accès refusé", 403);
    const visibility: Prisma.ProductWhereInput = {
              status: "ACTIVE",
              images: { isEmpty: false },
              NOT: [{ slug: { startsWith: "test-19a-" } }, { slug: "demo-bag-sample" }],
          };
    const where: any = admin ? {} : { ...visibility };
    if (
        query.minPrice !== undefined &&
        query.maxPrice !== undefined &&
        query.minPrice > query.maxPrice
    )
        throw new AppError("Le prix minimum dépasse le maximum", 400);
    if (query.availability === "in-stock" || query.size)
        where.variants = { some: { stock: { gt: 0 },
            ...(query.size ? { size: { equals: query.size, mode: "insensitive" } } : {}),
        } };
    if (query.minPrice !== undefined || query.maxPrice !== undefined)
        where.price = {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        };
    const orderBy: any =
        query.sort === "price-asc"
            ? [{ price: "asc" }, { id: "asc" }]
            : query.sort === "price-desc"
              ? [{ price: "desc" }, { id: "asc" }]
              : query.sort === "name"
                ? [{ nameFr: "asc" }, { id: "asc" }]
                : [{ createdAt: "desc" }, { id: "desc" }];
    if (admin && query.status) where.status = query.status;
    if (admin && query.ids) where.id = { in: query.ids };
    if (query.category) where.category = { slug: query.category };
    if (query.search)
        where.OR = ["nameFr", "nameAr", "nameEn"].map((field) => ({
            [field]: { contains: query.search, mode: "insensitive" },
        }));
    const [products, total, sizes] = await Promise.all([
        prisma.product.findMany({
            where,
            include,
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            orderBy,
        }),
        prisma.product.count({ where }),
        !admin && query.includeFilters === "1"
            ? prisma.productVariant.groupBy({
                by: ["size"],
                where: { stock: { gt: 0 }, product: { is: { ...visibility, ...(query.category ? { category: { slug: query.category } } : {}) } } },
              }).then(rows => rows.flatMap(row => row.size?.trim() && !isAmbiguousSize(row.size) ? [row.size] : []))
                // Suggestions are optional; a failure must not hide the catalog.
                .catch(() => null)
            : Promise.resolve(null),
    ]);
    return {
        success: true,
        data: admin ? products : products.map(publicProduct),
        total,
        page: query.page,
        totalPages: Math.ceil(total / query.limit),
        ...(sizes ? { filterOptions: { sizes: sizes.sort((a, b) => a.localeCompare(b, "en", { numeric: true })) } } : {}),
    };
}
export async function getProducts(req: Request, res: Response) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.json(await readPublicProducts(req.query));
}
export async function getAdminProducts(req: Request, res: Response) {
    res.json(await list(req.query, true));
}
export const readPublicProducts = (query: unknown) => list(query, false);
async function findPublicProduct(slugInput: unknown) {
    const slug = slugSchema.parse(slugInput);
    const product = await prisma.product.findUnique({ where: { slug }, include });
    if (
        !product ||
        product.status !== "ACTIVE" ||
        isFixture(product.slug) ||
        !product.images.length
    )
        throw new AppError("Produit introuvable", 404);
    return product;
}
export async function readPublicProduct(slugInput: unknown) {
    return { success: true, data: publicProduct(await findPublicProduct(slugInput)) };
}
export async function readPublicRecommendations(slugInput: unknown) {
    const source = await findPublicProduct(slugInput);
    const settings = recommendationSettings(source.recommendationSettings);
    const empty = { success: true, data: { upsell: [], crossSell: [] } };
    if (!settings.enabled) return empty;
    const ids = [...new Set([...settings.upsellProductIds, ...settings.crossSellProductIds])].filter(id => id !== source.id);
    if (!ids.length) return empty;
    const targets = await prisma.product.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, include });
    const eligible = new Map(targets.filter(recommendable).map(p => [p.id, publicProduct(p)]));
    const ordered = (selected: string[]) => selected.flatMap(id => eligible.has(id) ? [eligible.get(id)] : []);
    return { success: true, data: { upsell: ordered(settings.upsellProductIds), crossSell: ordered(settings.crossSellProductIds) } };
}
export async function getProductRecommendations(req: Request, res: Response) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.json(await readPublicRecommendations(req.params.slug));
}
export async function getProduct(req: Request, res: Response) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.json(await readPublicProduct(req.params.slug));
}
export async function createProduct(req: Request, res: Response) {
    // Defaults apply only to creation; partial edits must preserve publication status.
    const body = productSchema.extend({ status: productSchema.shape.status.default("DRAFT") }).parse(req.body);
    assertSizes(body.variants);
    assertPublishable(body);
    await validateRecommendationTargets(prisma, body.recommendationSettings);
    if (!(await prisma.category.findUnique({ where: { id: body.categoryId } })))
        throw new AppError("Catégorie introuvable", 400);
    const { variants, ...data } = body;
    if (variants.some((v) => v.id)) throw new AppError("Identifiant de variante inattendu", 400);
    const product = await prisma.product.create({
        data: { ...data, variants: { create: variants.map(({ id, expectedStock, ...v }) => v) } },
        include,
    });
    res.status(201).json({ success: true, data: product });
}
export async function updateProduct(req: Request, res: Response) {
    const input = productSchema.partial().parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
        const current = await tx.product.findUnique({ where: { id: req.params.id }, include });
        if (!current) throw new AppError("Produit introuvable", 404);
        await validateRecommendationTargets(tx, input.recommendationSettings, current.id);
        const { variants, ...data } = input;
        if (variants) assertSizes(variants, current.variants);
        if (data.categoryId && !(await tx.category.findUnique({ where: { id: data.categoryId } })))
            throw new AppError("Catégorie introuvable", 400);
        const ids = variants?.flatMap((v) => (v.id ? [v.id] : [])) || [];
        if (new Set(ids).size !== ids.length) throw new AppError("Variante répétée", 400);
        for (const variant of variants || []) {
            const { id, expectedStock, ...values } = variant;
            if (!id) {
                await tx.productVariant.create({ data: { ...values, productId: current.id } });
                continue;
            }
            const old = current.variants.find((v) => v.id === id);
            if (!old) throw new AppError("Cette variante appartient à un autre produit", 400);
            const { stock, ...metadata } = values;
            if (stock !== expectedStock) {
                if (expectedStock === undefined)
                    throw new AppError("Rechargez le stock avant de le modifier", 409);
                const changed = await tx.productVariant.updateMany({
                    where: { id, productId: current.id, stock: expectedStock },
                    data: { ...metadata, stock },
                });
                if (changed.count !== 1)
                    throw new AppError(
                        "Le stock a changé. Rechargez le produit avant de réessayer.",
                        409,
                    );
            } else {
                await tx.productVariant.update({ where: { id }, data: metadata });
            }
        }
        const updated = await tx.product.update({ where: { id: current.id }, data, include });
        assertPublishable(updated);
        return updated;
    });
    res.json({ success: true, data: product });
}
export async function deleteProduct(req: Request, res: Response) {
    await prisma.product.update({ where: { id: req.params.id }, data: { status: "ARCHIVED" } });
    res.json({ success: true, message: "Produit archivé" });
}
