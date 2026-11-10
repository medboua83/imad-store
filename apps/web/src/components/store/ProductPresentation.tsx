"use client";

import { useState, type ReactNode } from "react";
import { productColorKey } from "@imad-store/shared";
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
        const key = variant && productColorKey(variant);
        return product.colorPhotos?.find((link) => link.colorKey === key)?.image ?? product.images[0];
    }
    const [variantId, setVariantId] = useState(initialVariant?.id ?? "");
    const [photo, setPhoto] = useState(() => photoFor(initialVariant));

    return (
        <div className="product-layout">
            <ProductGallery
                images={product.images}
                name={product.nameAr || product.nameFr}
                selected={photo}
                onSelect={setPhoto}
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
