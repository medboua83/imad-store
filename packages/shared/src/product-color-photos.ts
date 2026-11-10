export type ProductColorPhoto = { colorKey: string; image: string };

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
