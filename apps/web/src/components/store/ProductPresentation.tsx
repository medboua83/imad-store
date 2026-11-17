"use client";

import { useState, type ReactNode } from "react";
import { isAmbiguousSize, productColorKey, productVariantImages } from "@imad-store/shared";
import type { Product } from "@/lib/api";
import { ProductGallery } from "./ProductGallery";
import { ProductOptions } from "./ProductOptions";

export function ProductPresentation({
    product,
    initialVariant,
    identity,
    unavailable,
    children,
}: {
    product: Product;
    initialVariant?: Product["variants"][number];
    identity: ReactNode;
    unavailable: ReactNode;
    children: ReactNode;
}) {
    function photoFor(variant?: Product["variants"][number]) {
        return productVariantImages(product, variant)[0];
    }
    const [variantId, setVariantId] = useState(initialVariant?.id ?? "");
    const [photo, setPhoto] = useState(() => photoFor(initialVariant));
    const variant = product.variants.find((entry) => entry.id === variantId);
    const selectedColor = variant && productColorKey(variant);
    const photoColors = new Set((product.colorPhotos ?? [])
        .filter((link) => link.image === photo && product.images.includes(link.image))
        .map((link) => link.colorKey));
    const photoMatches = photoColors.size === 1 && !!selectedColor && photoColors.has(selectedColor);
    function selectPhoto(image: string) {
        setPhoto(image);
        const keys = new Set((product.colorPhotos ?? [])
            .filter((link) => link.image === image && product.images.includes(link.image))
            .map((link) => link.colorKey));
        // A general/shared image cannot identify a purchasable colour reliably.
        if (keys.size !== 1) return;
        const choices = product.variants.filter((entry) => entry.stock > 0 &&
            !isAmbiguousSize(entry.size) && keys.has(productColorKey(entry)));
        const next = choices.find((entry) => entry.id === variantId)
            ?? choices.find((entry) => (entry.size ?? "").trim().toLowerCase() === (variant?.size ?? "").trim().toLowerCase())
            ?? choices[0];
        if (next) setVariantId(next.id);
    }

    return (
        <div className="product-layout">
            <ProductGallery
                images={product.images}
                name={product.nameAr || product.nameFr}
                selected={photo}
                onSelect={selectPhoto}
                notice={photoMatches ? undefined : "صورة من معرض المنتج؛ المرجع عند الطلب هو اللون المحدد في الخيارات أدناه."}
            />
            <div className="product-detail refined-detail">
                {identity}
                {unavailable ?? (
                    <ProductOptions
                        product={product}
                        variantId={variantId}
                        onVariantChange={(variant, colorClicked) => {
                            setVariantId(variant.id);
                            if (colorClicked) setPhoto(photoFor(variant));
                        }}
                    />
                )}
                {children}
            </div>
        </div>
    );
}
