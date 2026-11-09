// Carry only public catalogue filters. Never use an arbitrary URL as a return destination.
const catalogKeys = ["search", "category", "section", "sort", "minPrice", "maxPrice", "availability", "size", "page"];

export function catalogReturnPath(value: unknown): string | undefined {
    if (typeof value !== "string" || value.length > 2000 ||
        !/^\/shop(?:[?#]|$)/.test(value) || Array.from(value).some(char =>
            char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "\\")) return;
    const url = new URL(value, "https://catalog.invalid");
    if (url.origin !== "https://catalog.invalid" || url.pathname !== "/shop") return;
    const query = new URLSearchParams();
    for (const key of catalogKeys) {
        const values = url.searchParams.getAll(key);
        if (values.length === 1 && values[0]) query.set(key, values[0]);
    }
    return `/shop${query.size ? `?${query}` : ""}#catalog-results`;
}

export function productDetailsHref(slug: string, size?: string, returnTo?: unknown): string {
    const query = new URLSearchParams();
    if (size) query.set("size", size);
    const catalog = catalogReturnPath(returnTo);
    if (catalog) query.set("returnTo", catalog);
    return `/products/${encodeURIComponent(slug)}${query.size ? `?${query}` : ""}`;
}
