import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/server-api";
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/checkout", "/auth/", "/api/"] },
        sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
    };
}
