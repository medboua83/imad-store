import { recordOrderConversion } from "../lib/store-analytics";
import { Request, Response } from "express";
import { ORDER_WHATSAPP_NOTICE_VERSION } from "@imad-store/shared";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { bridgeOrderToAdmin, OrderForBridge } from "../lib/telegram-bridge";
import { appendOrderToSheets, updateOrderStatusInSheets } from "../lib/notifications";
import { createHash } from "crypto";
import { paginationSchema, statusSchema } from "../lib/validation";
import { transitionOrderStatus } from "../lib/order-lifecycle";

// Guest-only checkout schema — COD only (card payments disabled)
const createOrderSchema = z
    .object({
        paymentMethod: z.enum(["COD"]).default("COD"),
        // Accepted only for old clients/idempotent retries; never controls CRM delivery.
        crmConsent: z.boolean().default(false),
        aiServiceConsent: z.boolean().default(false),
        aiServiceConsentVersion: z.literal(ORDER_WHATSAPP_NOTICE_VERSION).optional(),
        expectedTotal: z.number().nonnegative().optional(),
        notes: z.string().max(2000).optional(),
        customer: z
            .object({
                fullName: z.string().trim().min(2, "Full name is required").max(120),
                phone: z.string().regex(/^(?:\+212|0)[5-7]\d{8}$/, "رقم الهاتف غير صالح"),
                email: z.string().email().optional().or(z.literal("")),
                street: z.string().trim().min(3, "Address is required").max(500),
                city: z.string().trim().min(1, "City is required").max(120),
                region: z.string().trim().min(1, "Region is required").max(120),
                postalCode: z.string().max(20).optional(),
            })
            .strict(),
        items: z
            .array(
                z
                    .object({
                        productId: z.string(),
                        variantId: z.string(),
                        quantity: z.number().int().min(1).max(10000),
                        price: z.number().optional(),
                        name: z.string().optional(),
                    })
                    .strict(),
            )
            .min(1, "Cart cannot be empty")
            .max(100),
    })
    .strict()
    .superRefine((value, ctx) => {
        if (
            value.aiServiceConsent &&
            value.aiServiceConsentVersion !== ORDER_WHATSAPP_NOTICE_VERSION
        )
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["aiServiceConsentVersion"],
                message: "Notice WhatsApp requise",
            });
        if (value.aiServiceConsent && !/^\+212[5-7]\d{8}$/.test(value.customer.phone))
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["customer", "phone"],
                message: "Pour WhatsApp, saisissez explicitement le numéro international +212…",
            });
    });

const ORDER_INCLUDE = {
    items: {
        include: {
            product: { select: { nameFr: true, nameAr: true, nameEn: true, images: true } },
            variant: { select: { colorNameFr: true, colorNameAr: true, size: true } },
        },
    },
};

export async function createOrder(req: Request, res: Response) {
    const body = createOrderSchema.parse(req.body);
    const key = req.header("Idempotency-Key")?.trim();
    if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) {
        throw new AppError("Idempotency-Key (16–128 letters/digits/_/-) required", 400);
    }
    // The fingerprint prevents using an existing key for a different cart/consent/customer.
    // Exclude UI-supplied price/name: the catalog determines the actual order price.
    const requestFingerprint = createHash("sha256")
        .update(
            JSON.stringify({
                customer: body.customer,
                paymentMethod: body.paymentMethod,
                crmConsent: body.crmConsent,
                ...(body.aiServiceConsent
                    ? {
                          aiServiceConsent: true,
                          aiServiceConsentVersion: body.aiServiceConsentVersion,
                      }
                    : {}),
                notes: body.notes ?? null,
                items: body.items.map((i) => ({
                    productId: i.productId,
                    variantId: i.variantId,
                    quantity: i.quantity,
                })),
            }),
        )
        .digest("hex");

    const findPrevious = () =>
        prisma.order.findUnique({
            where: { idempotencyKey: key },
            include: { ...ORDER_INCLUDE, events: true },
        });
    const previous = await findPrevious();
    if (previous) {
        if (previous.requestFingerprint !== requestFingerprint)
            throw new AppError("Idempotency key already used for another order", 409);
        await recordConversion(previous.id, previous.createdAt, req);
        return res.status(200).json({ success: true, data: previous, idempotentReplay: true });
    }

    let order: Awaited<ReturnType<typeof findPrevious>> = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            order = await prisma.$transaction(
                async (tx) => {
                    const ids = body.items.map((i) => i.productId);
                    const objectIds = ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
                    const slugs = ids.filter((id) => !/^[a-fA-F0-9]{24}$/.test(id));
                    const products = await tx.product.findMany({
                        where: {
                            OR: [
                                ...(objectIds.length ? [{ id: { in: objectIds } }] : []),
                                ...(slugs.length ? [{ slug: { in: slugs } }] : []),
                            ],
                        },
                        include: { variants: true },
                    });
                    const grouped = new Map<string, { quantity: number; productId: string }>();
                    const orderItems: {
                        productId: string;
                        variantId: string;
                        quantity: number;
                        unitPrice: number;
                    }[] = [];
                    let itemsTotal = 0;
                    for (const item of body.items) {
                        const product = products.find(
                            (p) => p.id === item.productId || p.slug === item.productId,
                        );
                        if (!product || product.status !== "ACTIVE")
                            throw new AppError("Requested product is unavailable", 400);
                        const variant = product.variants.find(
                            (v) => v.id === item.variantId || v.sku === item.variantId,
                        );
                        if (!variant || variant.productId !== product.id)
                            throw new AppError("Requested variant is unavailable", 400);
                        const aggregate = grouped.get(variant.id);
                        grouped.set(variant.id, {
                            quantity: (aggregate?.quantity ?? 0) + item.quantity,
                            productId: product.id,
                        });
                        const unitPrice = Number(product.price);
                        if (!Number.isFinite(unitPrice) || unitPrice < 0)
                            throw new AppError("Invalid product price", 400);
                        orderItems.push({
                            productId: product.id,
                            variantId: variant.id,
                            quantity: item.quantity,
                            unitPrice,
                        });
                        itemsTotal += unitPrice * item.quantity;
                    }
                    // Conditional inventory reservations ensure no overselling. Any failure aborts all writes.
                    for (const [variantId, requested] of grouped) {
                        const reserved = await tx.productVariant.updateMany({
                            where: {
                                id: variantId,
                                productId: requested.productId,
                                stock: { gte: requested.quantity },
                            },
                            data: { stock: { decrement: requested.quantity } },
                        });
                        if (reserved.count !== 1) throw new AppError("Insufficient stock", 409);
                    }
                    const settings = await tx.storeSettings.findUnique({
                        where: { id: "settings" },
                    });
                    if (settings?.codEnabled === false)
                        throw new AppError(
                            "Le paiement à la livraison est temporairement indisponible",
                            409,
                        );
                    const appliedShipping =
                        itemsTotal >= (settings?.freeShippingMin ?? 500)
                            ? 0
                            : Number(settings?.shippingCost ?? 30);
                    if (
                        body.expectedTotal !== undefined &&
                        Math.abs(body.expectedTotal - (itemsTotal + appliedShipping)) > 0.005
                    )
                        throw new AppError(
                            "Le total a changé. Actualisez votre panier avant de confirmer.",
                            409,
                        );
                    const created = await tx.order.create({
                        data: {
                            idempotencyKey: key,
                            requestFingerprint,
                            inventoryReserved: true,
                            aiServiceConsent: body.aiServiceConsent,
                            aiServiceConsentVersion: body.aiServiceConsent
                                ? body.aiServiceConsentVersion
                                : null,
                            aiServiceConsentAt: body.aiServiceConsent ? new Date() : null,
                            customerName: body.customer.fullName,
                            customerPhone: body.customer.phone,
                            customerEmail: body.customer.email || null,
                            fullName: body.customer.fullName,
                            phone: body.customer.phone,
                            street: body.customer.street,
                            city: body.customer.city,
                            region: body.customer.region,
                            postalCode: body.customer.postalCode,
                            paymentMethod: "COD",
                            paymentStatus: "PENDING",
                            status: "PENDING",
                            totalAmount: itemsTotal + appliedShipping,
                            shippingCost: appliedShipping,
                            notes: body.notes,
                            items: { create: orderItems },
                            events: {
                                create: {
                                    type: "created",
                                    message: `New COD order from ${body.customer.fullName}`,
                                },
                            },
                        },
                        include: { ...ORDER_INCLUDE, events: true },
                    });
                    // Delivery is controlled by the saved administrator integration setting.
                    // Keep the event atomic with the order/stock and never backfill older orders.
                    const crmIntegration = await tx.deskcommIntegration.findUnique({
                        where: { id: "deskcomm" },
                        select: { enabled: true, webhookCiphertext: true },
                    });
                    if (crmIntegration?.enabled && crmIntegration.webhookCiphertext) {
                        await tx.deskcommOutbox.create({
                            data: {
                                orderId: created.id,
                                payload: {
                                    id: created.id,
                                    captureVersion: 1,
                                    aiServiceConsent: created.aiServiceConsent === true,
                                    aiServiceConsentVersion:
                                        created.aiServiceConsentVersion ?? undefined,
                                    name: created.customerName ?? "",
                                    phone: created.customerPhone ?? "",
                                    email: created.customerEmail ?? undefined,
                                    street: created.street ?? "",
                                    city: created.city ?? "",
                                    region: created.region ?? "",
                                    totalAmount: created.totalAmount,
                                    shippingCost: created.shippingCost,
                                    status: created.status,
                                    paymentMethod: created.paymentMethod,
                                    items: created.items.map((i) => ({
                                        name:
                                            i.product?.nameFr ||
                                            i.product?.nameAr ||
                                            i.product?.nameEn ||
                                            "Produit",
                                        quantity: i.quantity,
                                        unitPrice: i.unitPrice,
                                    })),
                                },
                            },
                        });
                    }
                    return created;
                },
                { maxWait: 5000, timeout: 15000 },
            );
            break;
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "P2002") {
                const existing = await findPrevious();
                if (existing) {
                    if (existing.requestFingerprint !== requestFingerprint)
                        throw new AppError("Idempotency key already used for another order", 409);
                    return res
                        .status(200)
                        .json({ success: true, data: existing, idempotentReplay: true });
                }
            }
            if (code === "P2034" && attempt < 4) {
                await new Promise((resolve) =>
                    setTimeout(resolve, 30 * 2 ** attempt + Math.random() * 30),
                );
                continue;
            }
            throw err;
        }
    }
    if (!order) throw new AppError("Order transaction could not complete", 503);

    await recordConversion(order.id, order.createdAt, req);

    // External notifications are invoked ONLY after transaction commit; retries reuse the saved order.
    const locale = (req.headers["x-locale"] as "ar" | "fr" | "en" | undefined) ?? "fr";
    const bridgePayload: OrderForBridge = {
        id: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail ?? null,
        fullName: order.fullName ?? null,
        city: order.city ?? null,
        region: order.region ?? null,
        totalAmount: order.totalAmount,
        paymentMethod: "COD",
        items: order.items.map((i) => ({
            name: i.product?.nameFr || "Produit",
            quantity: i.quantity,
            unitPrice: i.unitPrice,
        })),
        notes: order.notes ?? null,
    };
    bridgeOrderToAdmin(bridgePayload, { locale }).catch(() =>
        console.error("Telegram bridge failed"),
    );
    appendOrderToSheets(order).catch(() => console.error("Google Sheets append failed"));
    return res.status(201).json({ success: true, data: order });
}

export async function getOrder(req: Request, res: Response) {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, status: true, paymentStatus: true, createdAt: true },
    });
    res.setHeader("Cache-Control", "no-store");
    if (!order) throw new AppError("Order not found", 404);
    res.json({ success: true, data: order });
}

export async function listOrders(req: Request, res: Response) {
    const { page, limit } = paginationSchema.parse(req.query);
    const status =
        req.query.status === undefined ? undefined : statusSchema.parse(req.query.status);
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: ORDER_INCLUDE,
            skip,
            take: Number(limit),
            orderBy: { createdAt: "desc" },
        }),
        prisma.order.count({ where }),
    ]);

    res.json({
        success: true,
        data: orders,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
    });
}

export async function updateOrderStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = z.object({ status: statusSchema }).strict().parse(req.body);
    const { order } = await transitionOrderStatus(id, status);

    // Google Sheets status update sync (best-effort, non-blocking)
    updateOrderStatusInSheets(order.id, status).catch((err) =>
        console.error("Google Sheets status update failed:", err),
    );

    res.json({ success: true, data: order });
}

// Admin: list notifications (polling endpoint)
export async function getAdminNotifications(_req: Request, res: Response) {
    const notifications = await prisma.adminNotification.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    const unread = await prisma.adminNotification.count({ where: { read: false } });
    res.json({ success: true, data: notifications, unread });
}

export async function markNotificationRead(req: Request, res: Response) {
    const { id } = req.params;
    await prisma.adminNotification.update({ where: { id }, data: { read: true } });
    res.json({ success: true });
}

export async function markAllNotificationsRead(_req: Request, res: Response) {
    await prisma.adminNotification.updateMany({ where: { read: false }, data: { read: true } });
    res.json({ success: true });
}

async function recordConversion(id: string, createdAt: Date, req: Request) {
    if (req.header("DNT") === "1" || req.header("Sec-GPC") === "1") return;
    try {
        await recordOrderConversion(
            id,
            createdAt,
            req.header("X-Analytics-Session"),
            req.header("X-Analytics-Test") === "1",
        );
    } catch {
        console.warn("Analytics attribution unavailable; order preserved");
    }
}
