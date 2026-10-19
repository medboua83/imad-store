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
function isIllustration(src: string) {
    return (
        src.includes("/catalogue-") ||
        Object.values(categoryIllustrations).some((asset) => src.endsWith(asset.split("/").pop()!))
    );
}
export function categoryVisual(category: Category, products: Product[]) {
    const image = category.image?.trim();
    if (image && !/cloudinary\.com\/demo\/|placehold(?:er)?\.|hero-1\.png/i.test(image))
        return { src: image, illustrative: isIllustration(image) };
    const product = products.find((p) => p.category?.slug === category.slug && p.images[0]);
    if (product)
        return { src: product.images[0], illustrative: product.images[0].includes("/catalogue-") };
    return { src: categoryIllustrations[category.slug] || null, illustrative: true };
}
