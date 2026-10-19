import { defaultSiteContent } from "@imad-store/shared";
import { prisma } from "./prisma";
export async function readPublicContent() {
    const row = await prisma.siteContent.findUnique({ where: { id: "site" } });
    return { success: true, data: row?.published || defaultSiteContent, revision: row?.revision || 0 };
}
