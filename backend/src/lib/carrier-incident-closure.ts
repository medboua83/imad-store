import { createHash } from "node:crypto";
import { Prisma, type CarrierIncidentClosure } from "@prisma/client";
import { canAdmin } from "@imad-store/shared";
import { z } from "zod";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";

type Shipment = { id: string; trackingId: string | null; state: string; carrierStatus: string | null; lastError: string | null; incidentVersion: number };
export const closeCarrierIncidentSchema = z.object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.string().trim().min(10).max(1000).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)),
}).strict();

export function carrierIncidentFingerprint(shipment: Shipment): string | null {
    if (shipment.state !== "ATTENTION" || !shipment.trackingId) return null;
    return createHash("sha256").update(JSON.stringify([
        "carrier-incident-v1", shipment.trackingId, shipment.state, shipment.carrierStatus, shipment.lastError, shipment.incidentVersion,
    ])).digest("hex");
}
export function carrierIncidentClosureDto(row: CarrierIncidentClosure) {
    return { id: row.id, orderId: row.orderId, fingerprint: row.fingerprint,
        trackingId: row.trackingId, carrierStatus: row.carrierStatus, reason: row.reason,
        closedById: row.closedById, closedByName: row.closedByName, closedAt: row.closedAt.toISOString() };
}

/** Same incident only: a new status, error, tracking ID or processing state reopens the alert. */
export function unclosedCarrierIncidentSql(alias: "tracking" | "shipment") {
    const row = Prisma.raw('"' + alias + '"');
    return Prisma.sql`NOT EXISTS (SELECT 1 FROM "carrier_incident_closures" closure
        WHERE closure."orderId" = ${row}."id" AND closure."trackingId" = ${row}."trackingId"
          AND closure."shipmentState" = ${row}."state"
          AND closure."carrierStatus" IS NOT DISTINCT FROM ${row}."carrierStatus"
          AND closure."incidentError" IS NOT DISTINCT FROM ${row}."lastError"
          AND closure."incidentVersion" = ${row}."incidentVersion")`;
}
export async function readOpenCarrierIncidentCount() {
    const [row] = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT count(*)::int AS count FROM "olivraison_shipments" shipment
        WHERE shipment."state" IN ('ATTENTION', 'RETRY') AND ${unclosedCarrierIncidentSql("shipment")}`);
    return row.count;
}

export async function withCarrierIncidentSummaries<T extends Shipment>(
    tx: Pick<Prisma.TransactionClient, "carrierIncidentClosure">, shipments: T[], history = false,
) {
    const keys = shipments.flatMap(s => {
        const fingerprint = carrierIncidentFingerprint(s);
        return fingerprint ? [{ orderId: s.id, fingerprint }] : [];
    });
    const rows = keys.length ? await tx.carrierIncidentClosure.findMany({ where: { OR: keys } }) : [];
    const counts = shipments.length ? await tx.carrierIncidentClosure.groupBy({ by: ["orderId"],
        where: { orderId: { in: shipments.map(s => s.id) } }, _count: { _all: true } }) : [];
    const historyCounts = new Map(counts.map(row => [row.orderId, row._count._all]));
    const current = new Map(rows.map(row => [row.orderId + ":" + row.fingerprint, row]));
    return await Promise.all(shipments.map(async s => {
        const fingerprint = carrierIncidentFingerprint(s);
        const closure = fingerprint ? current.get(s.id + ":" + fingerprint) : null;
        const prior = history ? await tx.carrierIncidentClosure.findMany({
            where: { orderId: s.id }, orderBy: [{ closedAt: "desc" }, { id: "desc" }], take: 20,
        }) : [];
        const { incidentVersion: _version, ...publicShipment } = s;
        return { ...publicShipment, ...(fingerprint ? { incidentFingerprint: fingerprint, incidentClosure: closure ? carrierIncidentClosureDto(closure) : null } : {}),
            ...(historyCounts.get(s.id) ? { incidentHistoryCount: historyCounts.get(s.id)! } : {}),
            ...(prior.length ? { incidentHistory: prior.map(carrierIncidentClosureDto) } : {}) };
    }));
}

/** Writes this new audit table only. No carrier client or commerce transition is invoked. */
export async function closeCarrierIncident(orderId: string, actorId: string, authVersion: number,
    input: z.infer<typeof closeCarrierIncidentSchema>) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            return await prisma.$transaction(async tx => {
                await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "olivraison_shipments" WHERE "id" = ${orderId} FOR UPDATE`);
                const [shipment, order, actor] = await Promise.all([
                    tx.olivraisonShipment.findUnique({ where: { id: orderId } }),
                    tx.order.findUnique({ where: { id: orderId }, select: { id: true } }),
                    tx.user.findUnique({ where: { id: actorId } }),
                ]);
                if (!actor?.isActive || actor.authVersion !== authVersion || !canAdmin(actor, "orders.read") || !canAdmin(actor, "orders.write"))
                    throw new AppError("Accès non autorisé pour ce compte.", 403);
                if (!shipment || !order) throw new AppError("Commande introuvable", 404);
                const fingerprint = carrierIncidentFingerprint(shipment);
                if (!fingerprint || fingerprint !== input.fingerprint)
                    throw new AppError("L’incident a changé. Actualisez le suivi avant de clôturer.", 409);
                const prior = await tx.carrierIncidentClosure.findUnique({ where: { orderId_fingerprint: { orderId, fingerprint } } });
                if (prior) return { orderId, closure: carrierIncidentClosureDto(prior), created: false };
                if (shipment.leaseToken && shipment.lockedUntil > new Date())
                    throw new AppError("Une synchronisation est en cours. Réessayez dans quelques instants.", 409);
                const closure = await tx.carrierIncidentClosure.create({ data: {
                    orderId, fingerprint, trackingId: shipment.trackingId!, shipmentState: shipment.state,
                    carrierStatus: shipment.carrierStatus, incidentError: shipment.lastError, incidentVersion: shipment.incidentVersion, reason: input.reason,
                    closedById: actor.id, closedByName: [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim() || "Administration",
                } });
                return { orderId, closure: carrierIncidentClosureDto(closure), created: true };
            });
        } catch (error) {
            if (["P2034", "P2002"].includes((error as { code?: string }).code || "") && attempt < 4) continue;
            throw error;
        }
    }
    throw new AppError("Actualisez le suivi avant de réessayer.", 409);
}
