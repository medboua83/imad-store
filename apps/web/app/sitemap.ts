import type { MetadataRoute } from "next";
import { siteOrigin, publicProducts } from "@/lib/server-api";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const origin = siteOrigin();
    const pages: MetadataRoute.Sitemap = [
        "/",
        "/shop",
        "/contact",
        "/delivery",
        "/returns",
        "/privacy",
    ].map((path) => ({ url: new URL(path, origin).toString() }));
    let page = 1,
        totalPages = 1;
    do {
        const result = await publicProducts({ limit: 100, page });
        totalPages = result.totalPages;
        pages.push(
            ...result.data.map((p) => ({ url: new URL(`/products/${p.slug}`, origin).toString() })),
        );
        page++;
    } while (page <= totalPages && page <= 400);
    return pages;
}
