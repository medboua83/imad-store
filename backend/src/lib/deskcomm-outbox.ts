import { assertStoreInstallation } from "./store-installation";
import { prisma } from "./prisma";
import { sendOrderToDeskcomm, DeskcommOrder } from "./deskcomm-crm";

const MAX_ATTEMPTS = 8;
const LOCK_MS = 120000;

export async function queueOrderForDeskcomm(order: DeskcommOrder): Promise<void> {
    await prisma.deskcommOutbox.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, payload: JSON.parse(JSON.stringify(order)) },
        update: {},
    });
}

let running = false;
export async function processDeskcommOutbox(): Promise<void> {
    await assertStoreInstallation();
    // IMAD_WORKER_TICK_OBSERVABILITY_V2: safe periodic function-entry marker.
    if (process.env.IMAD_WORKER_TICK_LOG === "true") {
        console.info("[IMAD_DESKCOMM_WORKER_TICK]", new Date().toISOString());
    }

    if (running || process.env.DESKCOMM_OUTBOX_WORKER_ENABLED !== "true") return;
    // A cutoff is mandatory: never replay old PENDING jobs on first activation.
    const minCreatedAtRaw = process.env.DESKCOMM_OUTBOX_MIN_CREATED_AT;
    if (
        !minCreatedAtRaw ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(minCreatedAtRaw)
    ) {
        console.error(
            "DeskcommCRM worker disabled: DESKCOMM_OUTBOX_MIN_CREATED_AT must be an ISO UTC timestamp",
        );
        return;
    }
    const minCreatedAt = new Date(minCreatedAtRaw);
    if (Number.isNaN(minCreatedAt.getTime()) || minCreatedAt.toISOString() !== minCreatedAtRaw) {
        console.error("DeskcommCRM worker disabled: invalid DESKCOMM_OUTBOX_MIN_CREATED_AT");
        return;
    }
    running = true;
    if (process.env.IMAD_WORKER_TICK_LOG === "true") {
        console.info("[IMAD_DESKCOMM_WORKER_ACTIVE]", new Date().toISOString());
    }
    try {
        // Administrator pause must not claim jobs or consume delivery attempts.
        const integration = await prisma.deskcommIntegration.findUnique({
            where: { id: "deskcomm" },
            select: { enabled: true, webhookCiphertext: true },
        });
        if (!integration?.enabled || !integration.webhookCiphertext) return;
        const now = new Date();
        const jobs = await prisma.deskcommOutbox.findMany({
            where: {
                attempts: { lt: MAX_ATTEMPTS },
                createdAt: { gte: minCreatedAt },
                OR: [
                    { status: "PENDING", nextAttemptAt: { lte: now } },
                    { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - LOCK_MS) } },
                ],
            },
            orderBy: { createdAt: "asc" },
            take: 10,
        });
        for (const job of jobs) {
            const claim = await prisma.deskcommOutbox.updateMany({
                where: {
                    id: job.id,
                    status: job.status,
                    attempts: job.attempts,
                    ...(job.status === "PROCESSING"
                        ? { lockedAt: job.lockedAt }
                        : { nextAttemptAt: { lte: now } }),
                },
                data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } },
            });
            if (claim.count !== 1) continue;
            try {
                await sendOrderToDeskcomm(job.payload as unknown as DeskcommOrder);
                await prisma.deskcommOutbox.update({
                    where: { id: job.id },
                    data: { status: "SENT", lockedAt: null, lastError: null },
                });
            } catch (err) {
                const attempts = job.attempts + 1;
                const wait = Math.min(3600000, 30000 * 2 ** Math.min(attempts - 1, 7));
                await prisma.deskcommOutbox.update({
                    where: { id: job.id },
                    data: {
                        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
                        lockedAt: null,
                        nextAttemptAt: new Date(Date.now() + wait),
                        lastError: err instanceof Error ? err.name : "UnknownError",
                    },
                });
            }
        }
    } finally {
        running = false;
    }
}
