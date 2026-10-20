import type { Category, Product } from "@/lib/api";

// Existing illustration assets, never represented as photographs of actual merchandise.
const categoryIllustrations: Record<string, string> = {
    abayas: "/images/catalogue-demo/630154c0785fe1868836c9b84aa19b71bd71b930e94012ce5c1b3e02e7f2289c.webp",
    "womens-shoes":
        "/images/catalogue-demo/d672c6abae309a550ff89cf1381982a754097936e286625f108d2f5ac5381d99.webp",
    shawls: "/images/catalogue-demo/6efbf6344c1d85abcd87bd82a38ab880187c4cb522c706ff7541e597df87dba2.webp",
    "mens-clogs":
        "/images/catalogue-demo/8cce892edd25a0f357b65af0fccca7196971ec0699b8626f23bcca01fa5b64b3.webp",
    bags: "/images/catalogue-test/sac.webp",
};
// Owner-selected generated category artwork, bundled so deployments retain it.
// This is category artwork, not a photograph of an actual catalogue product.
const selectedCategoryArtwork: Record<string, string> = {
    "mens-clogs": "/images/categories/sabots-homme-v2.webp",
};
export const categoryThumbnail = (slug: string) =>
    selectedCategoryArtwork[slug] || categoryIllustrations[slug];

function isIllustration(src: string) {
    return (
        src.includes("/catalogue-") ||
        Object.values(selectedCategoryArtwork).includes(src) ||
        Object.values(categoryIllustrations).some((asset) => src.endsWith(asset.split("/").pop()!))
    );
}
export function categoryImageSources(category: Category, products: Product[]) {
    const image = category.image?.trim();
    const custom =
        image && !/cloudinary\.com\/demo\/|placehold(?:er)?\.|hero-1\.png/i.test(image)
            ? [image]
            : [];
    const matching = products
        .filter((p) => p.category?.slug === category.slug)
        .flatMap((p) => p.images);
    const illustration = categoryIllustrations[category.slug];
    return [
        ...new Set(
            [
                selectedCategoryArtwork[category.slug],
                ...custom,
                ...matching,
                ...(illustration ? [illustration] : []),
            ].filter(Boolean),
        ),
    ];
}
export function categoryVisual(category: Category, products: Product[]) {
    const sources = categoryImageSources(category, products);
    return {
        src: sources[0] || null,
        sources,
        illustrative: !sources[0] || isIllustration(sources[0]),
    };
}
