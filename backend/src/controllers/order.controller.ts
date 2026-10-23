import { checkoutDeliverySchema } from "../lib/checkout-shipping";
import { enqueueOlivraison } from "../lib/olivraison-enqueue";
import { shippingFee } from "@imad-store/shared";
import { recordOrderConversion } from "../lib/store-analytics";
import { Request, Response } from "express";
import { isAmbiguousSize } from "@imad-store/shared";
import { ORDER_SERVICE_POLICY_VERSION, ORDER_WHATSAPP_NOTICE_VERSION } from "@imad-store/shared";
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
        confirmationMode: z.literal("SITE").optional(),
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
            !value.confirmationMode &&
            value.aiServiceConsent &&
            value.aiServiceConsentVersion !== ORDER_WHATSAPP_NOTICE_VERSION
        )
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["aiServiceConsentVersion"],
                message: "Notice WhatsApp requise",
            });
        if (
            !value.confirmationMode &&
            value.aiServiceConsent &&
            !/^\+212[5-7]\d{8}$/.test(value.customer.phone)
        )
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
                ...(body.confirmationMode ? { confirmationMode: body.confirmationMode } : {}),
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

    const delivery = checkoutDeliverySchema.parse({ customer: body.customer }).customer;
    let order: Awaited<ReturnType<typeof findPrevious>> = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            order = await prisma.$transaction(
                async (tx) => {
                    const settings = await tx.storeSettings.findUnique({
                        where: { id: "settings" },
                    });
                    const direct = settings?.directSiteConfirmation === true;
                    if (direct !== (body.confirmationMode === "SITE"))
                        throw new AppError(
                            "Le mode de confirmation a changé. Actualisez et vérifiez votre commande.",
                            409,
                        );
                    const crmIntegration = await tx.deskcommIntegration.findUnique({
                        where: { id: "deskcomm" },
                        select: {
                            enabled: true,
                            webhookCiphertext: true,
                            signingCiphertext: true,
                            orderAssistanceEnabled: true,
                        },
                    });
                    // Dashboard instruction and customer consent have distinct provenance.
                    const managedAssistance =
                        typeof crmIntegration?.orderAssistanceEnabled === "boolean";
                    const acceptedAssistance =
                        !direct && !managedAssistance && body.aiServiceConsent;
                    const orderServiceRequested = Boolean(
                        !direct &&
                        crmIntegration?.orderAssistanceEnabled === true &&
                        crmIntegration.enabled &&
                        crmIntegration.webhookCiphertext &&
                        crmIntegration.signingCiphertext,
                    );
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
                        if (!variant || variant.productId !== product.id || isAmbiguousSize(variant.size))
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
                    if (settings?.codEnabled === false)
                        throw new AppError(
                            "Le paiement à la livraison est temporairement indisponible",
                            409,
                        );
                    itemsTotal = Math.round(itemsTotal * 100) / 100;
                    const appliedShipping = shippingFee(
                        itemsTotal,
                        products.map((p) => ({ freeShipping: p.freeShipping, quantity: 1 })),
                        {
                            freeShippingMin: settings?.freeShippingMin ?? 500,
                            shippingCost: settings?.shippingCost ?? 30,
                        },
                    );
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
                            orderServiceRequested: managedAssistance ? orderServiceRequested : null,
                            orderServicePolicyVersion: managedAssistance
                                ? ORDER_SERVICE_POLICY_VERSION
                                : null,
                            orderServiceRequestedAt: orderServiceRequested ? new Date() : null,
                            aiServiceConsent: acceptedAssistance,
                            aiServiceConsentVersion: acceptedAssistance
                                ? body.aiServiceConsentVersion
                                : null,
                            aiServiceConsentAt: acceptedAssistance ? new Date() : null,
                            customerName: delivery.fullName,
                            customerPhone: delivery.phone,
                            customerEmail: body.customer.email || null,
                            fullName: delivery.fullName,
                            phone: delivery.phone,
                            street: delivery.street,
                            city: delivery.city,
                            region: body.customer.region,
                            postalCode: body.customer.postalCode,
                            paymentMethod: "COD",
                            paymentStatus: "PENDING",
                            status: direct ? "CONFIRMED" : "PENDING",
                            ...(direct
                                ? { confirmationMethod: "SITE", confirmedAt: new Date() }
                                : {}),
                            totalAmount: itemsTotal + appliedShipping,
                            shippingCost: appliedShipping,
                            notes: body.notes,
                            items: { create: orderItems },
                            events: {
                                create: {
                                    type: "created",
                                    message: direct
                                        ? "Commande confirmée sur le site par le client"
                                        : `New COD order from ${body.customer.fullName}`,
                                },
                            },
                        },
                        include: { ...ORDER_INCLUDE, events: true },
                    });
                    await enqueueOlivraison(tx, created);
                    // Never enqueue a silent downgrade between the validated choice and the saved receipt.
                    if (
                        created.aiServiceConsent !== acceptedAssistance ||
                        (acceptedAssistance &&
                            created.aiServiceConsentVersion !== body.aiServiceConsentVersion)
                    )
                        throw new AppError(
                            "Accord WhatsApp non enregistré ; aucune commande transmise",
                            503,
                        );
                    // Delivery is controlled by the saved administrator integration setting.
                    // Keep the event atomic with the order/stock and never backfill older orders.
                    if (crmIntegration?.enabled && crmIntegration.webhookCiphertext) {
                        await tx.deskcommOutbox.create({
                            data: {
                                orderId: created.id,
                                payload: {
                                    id: created.id,
                                    captureVersion: 1,
                                    ...(managedAssistance
                                        ? {
                                              orderServiceRequested,
                                              orderServicePolicyVersion:
                                                  ORDER_SERVICE_POLICY_VERSION,
                                          }
                                        : {}),
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
                                    ...(direct
                                        ? {
                                              confirmationMethod: "SITE",
                                              confirmedAt: created.confirmedAt!.toISOString(),
                                              confirmationRequired: false,
                                          }
                                        : {}),
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
    const trash = z.enum(["true", "false"]).default("false").parse(req.query.trash) === "true";
    const where = {
        ...(status ? { status } : {}),
        ...(trash
            ? { deletedAt: { not: null } }
            : {
                  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
              }),
    };
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

// Reversible removal only. Never delete orders, stock, outbox payloads or receipts.
export async function moveOrdersToTrash(req: Request, res: Response) {
    const { ids, restore } = z
        .object({
            ids: z
                .array(z.string().regex(/^[a-fA-F0-9]{24}$/))
                .min(1)
                .max(100),
            restore: z.boolean().default(false),
        })
        .strict()
        .parse(req.body);
    const uniqueIds = [...new Set(ids)];
    const count = await prisma.$transaction(async (tx) => {
        const orders = await tx.order.findMany({ where: { id: { in: uniqueIds } } });
        if (orders.length !== uniqueIds.length) throw new AppError("Commande introuvable", 404);
        if (orders.some((o) => o.status !== "CANCELLED" || o.inventoryReserved === true))
            throw new AppError(
                "Seules les commandes annulées sans stock réservé peuvent être supprimées",
                409,
            );
        const changed = orders.filter((o) =>
            restore ? o.deletedAt !== null : o.deletedAt === null,
        );
        if (!changed.length) return 0;
        const result = await tx.order.updateMany({
            where: {
                id: { in: changed.map((o) => o.id) },
                status: "CANCELLED",
                OR: [
                    { inventoryReserved: false },
                    { inventoryReserved: null },
                    { inventoryReserved: { isSet: false } },
                ],
            },
            data: { deletedAt: restore ? null : new Date() },
        });
        if (result.count !== changed.length)
            throw new AppError("Commandes modifiées entre-temps. Actualisez.", 409);
        await tx.orderEvent.createMany({
            data: changed.map((o) => ({
                orderId: o.id,
                type: restore ? "restored" : "trashed",
                message: restore
                    ? "Commande restaurée par un administrateur"
                    : "Commande déplacée dans la corbeille par un administrateur",
            })),
        });
        return result.count;
    });
    res.json({ success: true, count });
}
