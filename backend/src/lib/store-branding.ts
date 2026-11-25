import { resolveStoreBranding } from "@imad-store/shared";
import { prisma } from "./prisma";

export async function readStoreBranding() {
    const row = await prisma.storeBranding.findUnique({ where: { id: "store" } });
    // Keep the existing public address until the merchant explicitly saves the new settings.
    const content = !row ? await prisma.siteContent.findUnique({ where: { id: "site" } }) : null;
    const published = content?.published as { businessAddress?: string; policiesVerified?: boolean } | undefined;
    return { revision: row?.revision ?? 0, branding: resolveStoreBranding(row?.data as any ?? {
        contactAddress: published?.policiesVerified ? published.businessAddress : "",
    }) };
}
