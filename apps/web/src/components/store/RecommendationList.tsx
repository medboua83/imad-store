"use client";
import Link from "next/link";
import type { Product } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";
import { ProductPhoto } from "./ProductPhoto";
import { sellableVariants } from "@/lib/product-presentation";

export function RecommendationList({
    products,
    kind,
    compact = false,
    onNavigate,
}: {
    products: Product[];
    kind: "upsell" | "crossSell";
    compact?: boolean;
    onNavigate?: () => void;
}) {
    const items = useCartStore((s) => s.items);
    const seen = new Set<string>();
    const visible = products
        .filter((p) => {
            if (
                seen.has(p.id) ||
                !p.images.length ||
                p.status !== "ACTIVE" ||
                !sellableVariants(p.variants).some((v) => v.stock > 0) ||
                (kind === "crossSell" && items.some((item) => item.productId === p.id))
            )
                return false;
            seen.add(p.id);
            return true;
        })
        .slice(0, compact ? 2 : 4);
    if (!visible.length) return null;
    const title = kind === "upsell" ? "خيارات أخرى للمقارنة" : "أكملوا اختياراتكم";
    return (
        <section
            className={`product-recommendations${compact ? " recommendations-compact" : ""}`}
            aria-label={title}
        >
            <h2>{title}</h2>
            {!compact && (
                <p>
                    {kind === "upsell"
                        ? "قارنوا الموديلات واختاروا ما يناسبكم."
                        : "منتجات إضافية اختارها لكم المتجر. اختاروا اللون والمقاس قبل الإضافة."}
                </p>
            )}
            <div className="recommendation-grid">
                {visible.map((p) => (
                    <article className="recommendation-card" key={p.id}>
                        <Link
                            prefetch={false}
                            className="recommendation-photo"
                            href={`/products/${p.slug}`}
                            onClick={onNavigate}
                            aria-label={`عرض ${p.nameAr || p.nameFr}`}
                        >
                            <ProductPhoto
                                images={p.images}
                                name={p.nameAr || p.nameFr}
                                sizes={compact ? "72px" : "(max-width:767px) 40vw, 240px"}
                            />
                        </Link>
                        <div className="recommendation-info">
                            <h3>
                                <Link
                                    prefetch={false}
                                    href={`/products/${p.slug}`}
                                    onClick={onNavigate}
                                >
                                    {p.nameAr || p.nameFr}
                                </Link>
                            </h3>
                            <p className="recommendation-price" dir="ltr">
                                {p.price.toFixed(2)} <span>MAD</span>
                            </p>
                            {p.freeShipping && (
                                <p className="recommendation-shipping">توصيل مجاني</p>
                            )}
                            <Link
                                prefetch={false}
                                className="recommendation-choose"
                                href={`/products/${p.slug}`}
                                onClick={onNavigate}
                                aria-label={`اختيار خيارات ${p.nameAr || p.nameFr}`}
                            >
                                اختيار الخيارات
                            </Link>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
