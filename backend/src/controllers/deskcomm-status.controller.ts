import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../lib/prisma";
import { decryptDeskcommValue } from "../lib/deskcomm-config";
import { storeIdentity } from "../lib/store-installation";
import { Request, Response } from "express";
import { z } from "zod";
import { transitionOrderStatus } from "../lib/order-lifecycle";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function crmStatusConfig() {
    const saved = await prisma.deskcommConnection.findUnique({ where: { id: "deskcomm" } });
    if (saved) {
        const config = JSON.parse(decryptDeskcommValue(saved.ciphertext));
        const identity = storeIdentity();
        if (
            !identity ||
            config.storeId !== identity.storeId ||
            config.companyId !== identity.companyId ||
            !config.enabled
        )
            return null;
        return config as {
            secret: string;
            pipeline: string;
            stage: string;
            field: string;
            cutoff: string;
        };
    }
    if (storeIdentity()) return null; // New company profiles never inherit legacy credentials.
    const {
        DESKCOMM_STATUS_CALLBACK_ENABLED: enabled,
        DESKCOMM_STATUS_CALLBACK_SECRET: secret,
        DESKCOMM_STATUS_PIPELINE_ID: pipeline,
        DESKCOMM_STATUS_CONFIRMED_STAGE_ID: stage,
        DESKCOMM_STATUS_ORDER_FIELD: field,
        DESKCOMM_STATUS_MIN_OCCURRED_AT: cutoff,
    } = process.env;
    if (
        enabled !== "true" ||
        !secret ||
        !/^[a-f0-9]{64}$/i.test(secret) ||
        !pipeline ||
        !uuid.test(pipeline) ||
        !stage ||
        !uuid.test(stage) ||
        !field ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(field) ||
        !cutoff ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff) ||
        !Number.isFinite(Date.parse(cutoff)) ||
        new Date(cutoff).toISOString() !== cutoff
    )
        return null;
    return { secret, pipeline, stage, field, cutoff };
}
const envelope = z.object({
    event: z.literal("lead.stage_changed"),
    delivery_id: z.string().uuid(),
    happened_at: z.string().datetime(),
    data: z.object({
        to_stage_id: z.string().uuid(),
        lead: z.object({
            id: z.string().uuid(),
            pipeline_id: z.string().uuid(),
            stage_id: z.string().uuid(),
            custom_fields: z.record(z.unknown()),
        }),
    }),
});
export async function receiveDeskcommConfirmation(req: Request, res: Response) {
    res.setHeader("Cache-Control", "no-store");
    const config = await crmStatusConfig();
    if (!config) {
        res.status(503).json({ success: false, error: "CRM confirmation sync is disabled" });
        return;
    }
    if (!Buffer.isBuffer(req.body)) {
        res.status(415).json({ success: false, error: "JSON body required" });
        return;
    }
    const delivery = req.get("X-Webhook-Delivery") || "";
    const signed = req.get("X-Webhook-Signature") || "";
    const signature = /^t=(\d{10}),v1=([a-f0-9]{64})$/i.exec(signed);
    if (
        !uuid.test(delivery) ||
        !signature ||
        Math.abs(Date.now() / 1000 - Number(signature[1])) > 300
    ) {
        res.status(401).json({ success: false, error: "Invalid callback signature" });
        return;
    }
    const expected = createHmac("sha256", config.secret)
        .update(`${signature[1]}.${delivery}.`)
        .update(req.body)
        .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature[2], "hex"))) {
        res.status(401).json({ success: false, error: "Invalid callback signature" });
        return;
    }
    let body: unknown;
    try {
        body = JSON.parse(req.body.toString("utf8"));
    } catch {
        res.status(400).json({ success: false, error: "Invalid JSON" });
        return;
    }
    const parsed = envelope.safeParse(body);
    if (!parsed.success) {
        res.status(400).json({ success: false, error: "Unsupported CRM event" });
        return;
    }
    const event = parsed.data,
        lead = event.data.lead;
    if (event.delivery_id !== delivery) {
        res.status(400).json({ success: false, error: "Delivery identity mismatch" });
        return;
    }
    if (lead.pipeline_id !== config.pipeline) {
        res.status(403).json({ success: false, error: "Pipeline not allowed" });
        return;
    }
    if (
        Date.parse(event.happened_at) < Date.parse(config.cutoff) ||
        event.data.to_stage_id !== config.stage ||
        lead.stage_id !== config.stage
    ) {
        res.json({ success: true, ignored: true });
        return;
    }
    const reference = lead.custom_fields[config.field];
    if (typeof reference !== "string" || !/^[a-f0-9]{24}$/i.test(reference)) {
        res.status(400).json({ success: false, error: "Full store order reference required" });
        return;
    }
    const orderId = reference.toLowerCase();
    // Manual CRM retries change occurred_at; identity uses only immutable business fields.
    const fingerprint = createHash("sha256")
        .update(
            JSON.stringify({
                event: event.event,
                orderId,
                leadId: lead.id,
                pipeline: lead.pipeline_id,
                stage: event.data.to_stage_id,
                happenedAt: event.happened_at,
            }),
        )
        .digest("hex");
    const result = await transitionOrderStatus(orderId, "CONFIRMED", "crm", {
        deliveryId: delivery,
        leadId: lead.id,
        fingerprint,
    });
    res.json({
        success: true,
        data: {
            reference: orderId.slice(-8).toUpperCase(),
            status: result.order.status,
            changed: result.changed,
        },
    });
}
