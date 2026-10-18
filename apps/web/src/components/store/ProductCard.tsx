import Image from "next/image";
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
    const colors = [...new Map(p.variants.map((v) => [v.color, v])).values()];
    return (
        <article className="catalog-card">
            <Link prefetch={false} href={`/products/${p.slug}`} className="catalog-card-image">
                {p.images[0] && (
                    <Image
                        src={p.images[0]}
                        alt={name}
                        fill
                        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                        className="object-cover"
                    />
                )}
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
                        {p.price.toFixed(2)} <span>MAD</span>
                    </p>
                </div>
                <div className="card-bottom">
                    <p className="variant-hint">
                        {colors.length} {colors.length === 1 ? "لون" : "ألوان"} ·{" "}
                        {p.variants.length} {p.variants.length === 1 ? "خيار" : "خيارات"}
                    </p>
                    <Link prefetch={false} href={`/products/${p.slug}`} className="text-link">
                        اختيار التفاصيل <ArrowUpLeft size={16} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </article>
    );
}
