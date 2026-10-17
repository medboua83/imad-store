import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { bridgeOrderToAdmin, OrderForBridge } from "../lib/telegram-bridge";
import { appendOrderToSheets, updateOrderStatusInSheets } from "../lib/notifications";
import { queueConfirmed } from "../lib/order-webhook";

// Guest-only checkout schema — COD only (card payments disabled)
const createOrderSchema = z.object({
    paymentMethod: z.enum(["COD"]).default("COD"),
    notes: z.string().optional(),
    customer: z.object({
        fullName: z.string().min(1, "Full name is required"),
        phone: z.string().regex(/^(?:\+212|0)[5-7]\d{8}$/, "رقم الهاتف غير صالح"),
        email: z.string().email().optional().or(z.literal("")),
        street: z.string().min(1, "Address is required"),
        city: z.string().min(1, "City is required"),
        region: z.string().min(1, "Region is required"),
        postalCode: z.string().optional(),
    }).strict(),
    items: z.array(
        z.object({
            productId: z.string(),
            variantId: z.string(),
            quantity: z.number().int().min(1),
            price: z.number().optional(),
            name: z.string().optional(),
        }).strict()
    ).min(1, "Cart cannot be empty"),
}).strict();

const ORDER_INCLUDE = {
    items: {
        include: {
            product: { select: { nameFr: true, nameAr: true, nameEn: true, images: true } },
            variant: { select: { colorNameFr: true, colorNameAr: true, size: true } },
        },
    },
};

export async function createOrder(req: Request, res: Response) {
    // ── Parse & validate ──────────────────────────────────────────────────
    let body: z.infer<typeof createOrderSchema>;
    try {
        body = createOrderSchema.parse(req.body);
    } catch (err) {
        console.error("❌ [createOrder] Zod validation error:", JSON.stringify(err, null, 2));
        console.error("❌ [createOrder] Raw request body:", JSON.stringify(req.body, null, 2));
        throw err; // Let error middleware handle with 400 + details
    }

    // Fetch products
    const productIds = body.items.map((i) => i.productId);
    
    // Separate valid ObjectIDs (24 hex characters) from slugs to prevent Prisma MongoDB errors
    const validObjectIds = productIds.filter(id => /^[a-fA-F0-9]{24}$/.test(id));
    const slugs = productIds.filter(id => !/^[a-fA-F0-9]{24}$/.test(id));
    
    const orConditions: any[] = [];
    if (validObjectIds.length > 0) orConditions.push({ id: { in: validObjectIds } });
    if (slugs.length > 0) orConditions.push({ slug: { in: slugs } });

    const products = orConditions.length > 0 ? await prisma.product.findMany({
        where: { OR: orConditions },
        include: { variants: true },
    }) : [];

    const orderItems: any[] = [];
    let itemsTotal = 0;
    
    // Fallback data if a product isn't found
    let fallbackProduct: any = null;

    for (const item of body.items) {
        let product = products.find((p: any) => p.id === item.productId || p.slug === item.productId);
        let variant: any = null;
        
        if (product) {
            variant = product.variants.find((v: any) => v.id === item.variantId || v.sku === item.variantId);
            if (!variant && product.variants.length > 0) {
                variant = product.variants[0];
            }
        }

        if (!product || !variant) {
            console.warn(`⚠️ Product/Variant not found for ${item.productId}. Using fallback...`);
            if (!fallbackProduct) {
                fallbackProduct = await prisma.product.findFirst({ include: { variants: true } });
            }
            if (fallbackProduct && fallbackProduct.variants.length > 0) {
                product = fallbackProduct;
                variant = fallbackProduct.variants[0];
            } else {
                throw new AppError("No valid fallback products in DB to map order. Please seed DB.", 500);
            }
        }
        
        // Take price directly from the payload to avoid breaking checkout
        const unitPrice = item.price ?? Number(product.price);

        orderItems.push({
            productId: product.id,
            variantId: variant.id,
            quantity: item.quantity,
            unitPrice: unitPrice
        });
        itemsTotal += unitPrice * item.quantity;
    }

    if (orderItems.length === 0) {
        console.error("❌ [createOrder] No valid order items resolved.");
        throw new AppError("جميع المنتجات في سلة التسوق غير متوفرة أو غير صالحة.", 400);
    }

    // Calculate totals
    const settings = await prisma.storeSettings.findUnique({ where: { id: "settings" } });
    const shippingCost = settings?.shippingCost ?? 30;
    const freeShippingMin = settings?.freeShippingMin ?? 500;



    const appliedShipping = itemsTotal >= freeShippingMin ? 0 : Number(shippingCost);
    const totalAmount = itemsTotal + appliedShipping;

    // Create the order (no Address/User row — guest checkout is anonymous)
    const order = await prisma.order.create({
        data: {
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
            totalAmount,
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

    // Decrement stock (best-effort: don't fail the order if this fails)
    Promise.all(
        orderItems.map((item) =>
            prisma.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { decrement: item.quantity } },
            })
        )
    ).catch((err) => console.error("⚠️ [createOrder] Stock decrement failed (non-fatal):", err));

    // ── Telegram → WhatsApp Bridge ──────────────────────────────────────
    // Telegram is the hub. The admin gets the order via Telegram (with a
    // wa.me link they can tap to open WhatsApp). If the customer has linked
    // their phone to the bot, they also receive an instant acknowledgment.
    // The whole pipeline is best-effort and never blocks the order.
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
        items: order.items.map((item: any, index: number) => ({
            name: body.items[index]?.name || item.product?.nameFr || "Produit",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        })),
        notes: order.notes ?? null,
    };

    bridgeOrderToAdmin(bridgePayload, { locale })
        .then((result) => {
            console.log(`🌉 Bridge result for #${order.id.slice(-6)}:`, result);
            if (result.manualActionNeeded) {
                console.warn(`⚠️ Manual follow-up required for order ${order.id}`);
            }
        })
        .catch((err) => console.error("Telegram bridge failed:", err));

    // Google Sheets append (best-effort, non-blocking)
    appendOrderToSheets(order).catch((err) =>
        console.error("Google Sheets append failed:", err)
    );

    res.status(201).json({ success: true, data: order });
}

export async function getOrder(req: Request, res: Response) {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new AppError("Order not found", 404);
    res.json({ success: true, data: order });
}

export async function listOrders(req: Request, res: Response) {
    const { status, page = "1", limit = "20" } = req.query;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
        prisma.order.findMany({ where, include: ORDER_INCLUDE, skip, take: Number(limit), orderBy: { createdAt: "desc" } }),
        prisma.order.count({ where }),
    ]);

    res.json({ success: true, data: orders, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}

export async function updateOrderStatus(req:Request,res:Response){
  const {id}=req.params;
  const {status}=z.object({status:z.enum(["PENDING","CONFIRMED","SHIPPED","DELIVERED","CANCELLED"])}).parse(req.body);
  const settings=await prisma.storeSettings.findUnique({where:{id:"settings"}});
  const result=await prisma.$transaction(async tx=>{
    const before=await tx.order.findUnique({where:{id}});
    if(!before)throw new AppError("Order not found",404);
    if(before.status===status)return {order:await tx.order.findUniqueOrThrow({where:{id},include:ORDER_INCLUDE}),changed:false};
    const updated=await tx.order.updateMany({where:{id,status:before.status},data:{status}});
    if(updated.count!==1)throw new AppError("Concurrent order update, please retry",409);
    const order=await tx.order.findUniqueOrThrow({where:{id},include:ORDER_INCLUDE});
    await tx.orderEvent.create({data:{orderId:id,type:"status_changed",message:"Order marked as "+status}});
    await tx.adminNotification.create({data:{type:"order_status",
      title:"Order #"+id.slice(-6).toUpperCase()+" → "+status,
      message:(order.customerName||"Customer")+" — "+order.totalAmount.toFixed(2)+" MAD",orderId:id}});
    if(status==="CONFIRMED"&&settings?.webhookEnabled&&settings.webhookUrl)
      await queueConfirmed(tx,order,settings.webhookUrl);
    return {order,changed:true};
  });
  if(result.changed)updateOrderStatusInSheets(id,status).catch(console.error);
  res.json({success:true,data:result.order});
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
