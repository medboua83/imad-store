import type { Product } from "@/lib/api";
export type DraftVariant = {
    key: string;
    id?: string;
    expectedStock?: number;
    color: string;
    colorNameFr: string;
    colorNameAr: string;
    colorNameEn: string;
    size: string;
    stock: string;
    sku: string;
};
export function productSlug(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 160)
        .replace(/-$/g, "");
}
export function variantPayload(variants: DraftVariant[]) {
    const seen = new Set<string>();
    return variants.map((v, index) => {
        const sku = v.sku.trim();
        if (!sku || sku.length > 100)
            throw new Error(
                `Variante ${index + 1} : référence SKU obligatoire (100 caractères maximum).`,
            );
        if (seen.has(sku.toUpperCase()))
            throw new Error(`La référence ${sku} est utilisée plusieurs fois.`);
        seen.add(sku.toUpperCase());
        if (!/^\d+$/.test(v.stock) || Number(v.stock) > 1000000)
            throw new Error(`Variante ${index + 1} : stock entier obligatoire, de 0 à 1 000 000.`);
        return {
            ...(v.id ? { id: v.id, expectedStock: v.expectedStock } : {}),
            color: v.color,
            colorNameFr: v.colorNameFr.trim(),
            colorNameAr: v.colorNameAr.trim(),
            colorNameEn: v.colorNameEn.trim(),
            size: v.size.trim(),
            stock: Number(v.stock),
            sku,
        };
    });
}
export function sizeVariants(
    source: DraftVariant,
    text: string,
    slug: string,
    existing: DraftVariant[],
) {
    const sizeMap = new Map<string, string>();
    for (const size of text
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (size.length > 40) throw new Error("Une taille ne peut pas dépasser 40 caractères.");
        if (!sizeMap.has(size.toLowerCase())) sizeMap.set(size.toLowerCase(), size);
    }
    const sizes = [...sizeMap.values()];
    if (!sizes.length) throw new Error("Indiquez au moins une taille, séparée par une virgule.");
    const seen = new Set(existing.map((v) => v.sku.trim().toUpperCase()));
    const combinations = new Set(
        existing.map((v) => `${v.color.trim().toLowerCase()}|${v.size.trim().toLowerCase()}`),
    );
    const missing = sizes.filter(
        (size) => !combinations.has(`${source.color.trim().toLowerCase()}|${size.toLowerCase()}`),
    );
    if (existing.length + missing.length > 100)
        throw new Error("Maximum 100 variantes par produit.");
    return missing.map((size) => {
        const base = (
            productSlug(`${slug || "produit"}-${source.colorNameFr || source.color}-${size}`) ||
            "variante"
        )
            .slice(0, 92)
            .toUpperCase();
        let sku = base,
            n = 2;
        while (seen.has(sku)) sku = `${base}-${n++}`;
        seen.add(sku);
        return {
            color: source.color,
            colorNameFr: source.colorNameFr,
            colorNameAr: source.colorNameAr,
            colorNameEn: source.colorNameEn,
            size,
            sku,
            stock: "0",
        };
    });
}
export function stockMatches(product: Product, stock: string) {
    return (
        stock === "ALL" ||
        (stock === "LOW" && product.variants.some((v) => v.stock <= 3)) ||
        (stock === "OUT" &&
            product.variants.length > 0 &&
            product.variants.every((v) => v.stock === 0)) ||
        (stock === "NONE" && !product.variants.length)
    );
}
export function stockSummary(products: Product[]) {
    const active = products.filter((p) => p.status === "ACTIVE");
    return {
        active: active.length,
        units: active.reduce((sum, p) => sum + p.variants.reduce((n, v) => n + v.stock, 0), 0),
        low: active.flatMap((p) => p.variants).filter((v) => v.stock <= 3).length,
    };
}
export function validatePhoto(file: { type: string; size: number }, remaining: number) {
    if (remaining <= 0) return "Maximum 12 photos. Retirez une photo avant d’en ajouter.";
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        return "Format non pris en charge : choisissez PNG, JPEG ou WebP.";
    if (file.size === 0) return "Le fichier est vide.";
    if (file.size > 5 * 1024 * 1024) return "Cette photo dépasse 5 Mo.";
    return null;
}
