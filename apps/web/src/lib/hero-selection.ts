import { isAmbiguousSize } from "@imad-store/shared";
import type { Product } from "./api";

export function isAvailableHeroProduct(product: Product) {
    return (
        product.status === "ACTIVE" &&
        product.images.length > 0 &&
        product.variants.some((variant) => variant.stock > 0 && !isAmbiguousSize(variant.size))
    );
}
