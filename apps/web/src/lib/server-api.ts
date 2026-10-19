import "server-only";
import { cache } from "react";
import type { Product, ProductsResponse, Category, StoreSettings } from "./api";
import { defaultSiteContent, type SiteContent } from "@imad-store/shared";
const upstream = () => (process.env.API_UPSTREAM_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
async function publicRequest(path: string): Promise<Response> {
    if (process.env.IMAD_HOSTING_MODE === "combined") {
        const read = (globalThis as unknown as Record<symbol, ((path: string) => Promise<{ status: number; body: unknown }>) | undefined>)[Symbol.for("imad.publicStoreRead")];
        if (!read) throw new Error("Public store reader unavailable");
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const result = await Promise.race([
                read(path),
                new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Public store read timed out")), 8000); }),
            ]);
            return new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json" } });
        } finally { clearTimeout(timer); }
    }
    return fetch(`${upstream()}/api${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
}
export async function serverGet<T>(path: string): Promise<T> {
    const response = await publicRequest(path);
    if (!response.ok) throw new Error(`Store API unavailable (${response.status})`);
    return (await response.json()) as T;
}
export const publicContent = cache(async () => {
    const response = await serverGet<{ data: SiteContent }>("/content");
    return { ...defaultSiteContent, ...response.data };
});
export const publicCategories = cache(
    async () => (await serverGet<{ data: Category[] }>("/categories")).data,
);
export const publicSettings = cache(
    async () => (await serverGet<{ data: StoreSettings }>("/settings")).data,
);
export const publicProduct = cache(async (slug: string): Promise<Product | null> => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
    const response = await publicRequest(`/products/${encodeURIComponent(slug)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Product unavailable");
    return (await response.json()).data;
});
export async function publicProducts(params: Record<string, string | number | undefined> = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
        if (value !== undefined && value !== "") query.set(key, String(value));
    return serverGet<ProductsResponse>(`/products?${query}`);
}
export const siteOrigin = () => new URL(process.env.SITE_URL || "http://localhost:3000");
