export type ProductColorPhoto = { colorKey: string; image: string };

/** Existing exact-colour links keep their meaning; groups are bounded hex unions. */
export function catalogColorValues(value: string): string[] | undefined {
    if (!value.startsWith("group:")) return value.length > 0 && value.length <= 80 ? [value] : undefined;
    if (value.length > 806 || !/^group:#[0-9a-f]{6}(,#[0-9a-f]{6}){1,99}$/i.test(value)) return;
    return [...new Set(value.slice(6).toLowerCase().split(","))];
}

type ProductColor = {
    color: string;
    colorNameFr: string;
    colorNameAr: string;
    colorNameEn: string;
};

export function productColorKey(variant: ProductColor) {
    const name = [variant.colorNameFr, variant.colorNameAr, variant.colorNameEn]
        .map((value) => value.trim())
        .find(Boolean) ?? "";
    return `${variant.color.trim().toLowerCase()}|${name.toLowerCase()}`;
}

export function validColorPhotos(
    links: ProductColorPhoto[],
    images: string[],
    variants: ProductColor[],
) {
    const colors = new Set(variants.map(productColorKey));
    const gallery = new Set(images);
    return links.filter(({ colorKey, image }) => colors.has(colorKey) && gallery.has(image));
}

/** A mapped variant must never fall back to a different colour when its photo fails. */
export function productVariantImages(
    product: { images: string[]; colorPhotos?: ProductColorPhoto[] | null },
    variant?: ProductColor,
): string[] {
    const key = variant && product.colorPhotos?.length ? productColorKey(variant) : undefined;
    const mapped = product.colorPhotos?.find(
        (link) => link.colorKey === key && product.images.includes(link.image),
    )?.image;
    return mapped ? [mapped] : [...product.images];
}
