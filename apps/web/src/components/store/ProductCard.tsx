import { ProductPhoto } from "./ProductPhoto";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import type { Product } from "@/lib/api";
export function ProductCard({
    product: p,
    headingLevel = 2,
}: {
    product: Product;
    headingLevel?: 2 | 3;
}) {
    const Heading = headingLevel === 3 ? "h3" : "h2";
    const name = p.nameAr || p.nameFr;
    const available = p.variants.some((v) => v.stock > 0);
    const offered = available ? p.variants.filter((v) => v.stock > 0) : p.variants;
    const colors = [...new Map(offered.map((v) => [v.color, v])).values()];
    const sizes = [...new Set(offered.map((v) => v.size).filter(Boolean))];
    return (
        <article className="catalog-card">
            <Link
                prefetch={false}
                href={`/products/${p.slug}`}
                className="catalog-card-image"
                aria-label={`عرض تفاصيل ${name}`}
            >
                <ProductPhoto images={p.images} name={name} />
                <span className={`stock-pill ${available ? "" : "stock-pill-empty"}`}>
                    {available ? "متوفر الآن" : "نفدت الكمية"}
                </span>
                <span className="card-image-arrow" aria-hidden="true">
                    <ArrowUpLeft size={21} />
                </span>
            </Link>
            <div className="catalog-card-body">
                <p className="card-category">{p.category?.nameAr || p.category?.nameFr}</p>
                <div className="card-title-row">
                    <Heading>
                        <Link prefetch={false} href={`/products/${p.slug}`}>
                            {name}
                        </Link>
                    </Heading>
                    <p className="card-price" dir="ltr">
                        {p.freeShipping && <span className="product-shipping-badge">توصيل مجاني</span>}
                        {p.compareAtPrice && p.compareAtPrice > p.price ? (
                            <del>{p.compareAtPrice.toFixed(2)} MAD</del>
                        ) : null}
                        <span className="product-current-price">
                            {p.price.toFixed(2)} <span>MAD</span>
                        </span>
                    </p>
                </div>
                <div className="product-option-preview" aria-label="خيارات المنتج">
                    {colors.slice(0, 2).map((v) => (
                        <span key={v.color} className="product-color-label">
                            {/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.color) && (
                                <i style={{ backgroundColor: v.color }} aria-hidden="true" />
                            )}
                            {v.colorNameAr || v.colorNameFr || v.color}
                        </span>
                    ))}
                    {colors.length > 2 && <span>+{colors.length - 2}</span>}
                </div>
                {sizes.length > 0 && (
                    <p className="product-size-preview">
                        المقاسات:{" "}
                        <bdi>
                            {sizes.slice(0, 4).join(" · ")}
                            {sizes.length > 4 ? ` +${sizes.length - 4}` : ""}
                        </bdi>
                    </p>
                )}
                <div className="card-bottom">
                    <p className="variant-hint">
                        {colors.length} {colors.length === 1 ? "لون" : "ألوان"} · {offered.length}{" "}
                        {offered.length === 1 ? "خيار" : "خيارات"}
                    </p>
                    <Link prefetch={false} href={`/products/${p.slug}`} className="text-link">
                        اختيار التفاصيل <ArrowUpLeft size={16} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </article>
    );
}
