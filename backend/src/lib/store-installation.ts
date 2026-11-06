import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";
import { z } from "zod";

export function storeIdentity() {
    const storeId = process.env.STORE_INSTANCE_ID;
    const companyId = process.env.CRM_COMPANY_ID;
    if (!storeId && !companyId) return null; // Existing installations remain compatible.
    if (
        !z.string().uuid().safeParse(storeId).success ||
        !z.string().uuid().safeParse(companyId).success
    )
        throw new AppError("Identité de boutique incomplète ou invalide", 503);
    return { storeId: storeId!, companyId: companyId! };
}

/** This application is one company per deployment, never a shared tenant database. */
export async function assertStoreInstallation() {
    const identity = storeIdentity();
    if (!identity) {
        if (await prisma.storeInstallation.findUnique({ where: { id: "installation" } }))
            throw new AppError("Le profil entreprise de cette installation est requis", 503);
        return;
    }
    let saved = await prisma.storeInstallation.findUnique({ where: { id: "installation" } });
    if (!saved) {
        // Never adopt a copied commerce database as a new company's installation.
        const delegates = [
            prisma.user,
            prisma.refreshToken,
            prisma.address,
            prisma.adminNotification,
            prisma.category,
            prisma.product,
            prisma.productVariant,
            prisma.order,
            prisma.orderItem,
            prisma.orderEvent,
            prisma.storeSettings,
            prisma.telegramCustomer,
            prisma.deskcommOutbox,
            prisma.deskcommIntegration,
            prisma.siteContent,
            prisma.deskcommStatusReceipt,
            prisma.deskcommConnection,
            prisma.olivraisonIntegration,
            prisma.olivraisonShipment,
        ];
        const analytics = await prisma.storeAnalytics.count();
        if (
            analytics ||
            (
                await Promise.all(
                    delegates.map((model) =>
                        (model as unknown as { count: () => Promise<number> }).count(),
                    ),
                )
            ).some(Boolean)
        )
            throw new AppError("Utilisez une base vide et indépendante pour cette entreprise", 503);
        try {
            saved = await prisma.storeInstallation.create({
                data: { id: "installation", ...identity },
            });
        } catch (error) {
            if ((error as { code?: string }).code !== "P2002") throw error;
            saved = await prisma.storeInstallation.findUnique({ where: { id: "installation" } });
        }
    }
    if (!saved || saved.storeId !== identity.storeId || saved.companyId !== identity.companyId)
        throw new AppError("Cette base appartient à une autre installation", 503);
    if (!saved.initialized) {
        // Unique indexes and foreign keys are applied by prisma migrate deploy.
        // Do not mark a profile ready against a schema without its idempotency constraint.
        const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
            SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()
            AND tablename = 'orders' AND indexname = 'orders_idempotencyKey_key'`;
        if (indexes.length !== 1) throw new AppError("Les migrations de la boutique sont requises", 503);
        await prisma.storeInstallation.update({
            where: { id: "installation" },
            data: { initialized: true },
        });
    }
}
