import { defaultSiteContent } from "@imad-store/shared";
import { prisma } from "./prisma";
import { readHeroProducts } from "../controllers/product.controller";
import { MAX_HERO_PRODUCTS, usesManualHeroSelection, type SiteContent } from "@imad-store/shared";
export async function readPublicContent() {
    const row = await prisma.siteContent.findUnique({ where: { id: "site" } });
    return {
        success: true,
        data: row?.published || defaultSiteContent,
        revision: row?.revision || 0,
    };
}
export async function readPublicHeroProducts() {
    const published = (await readPublicContent()).data as unknown as SiteContent;
    const ids = published.heroProductIds;
    if (!usesManualHeroSelection(published)) return { success: true, data: [] };
    if (
        !Array.isArray(ids) ||
        ids.length > MAX_HERO_PRODUCTS ||
        ids.some((id) => !/^[a-f0-9]{24}$/.test(id))
    )
        return { success: true, data: [] };
    return { success: true, data: await readHeroProducts(ids) };
}
