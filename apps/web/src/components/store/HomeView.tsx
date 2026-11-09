import { ProductPhoto } from "./ProductPhoto";
import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowUpLeft } from "lucide-react";
import type { SiteContent } from "@imad-store/shared";
import type { Product, Category } from "@/lib/api";
import { categoryVisual } from "./category-visuals";
import { ProductCard } from "./ProductCard";
import { availableCatalogSections, publishedCategories } from "@/lib/catalog-navigation";
import { CatalogSectionLinks } from "./CatalogSectionLinks";
function DraftPreviewLink(props: ComponentProps<typeof Link>) {
    const localAnchor = typeof props.href === "string" && props.href.startsWith("#");
    return (
        <Link
            {...props}
            target={localAnchor ? undefined : "_blank"}
            rel={localAnchor ? undefined : "noopener noreferrer"}
        />
    );
}
export function HomeView({
    content,
    products,
    categories,
    preview = false,
}: {
    content: SiteContent;
    products: Product[];
    categories: Category[];
    preview?: boolean;
}) {
    const ViewLink = preview ? DraftPreviewLink : Link;
    const featured = products.find((p) => p.category?.slug === "abayas") || products[0];
    const detail =
        products.find((p) => p.category?.slug === "shawls") ||
        products.find((p) => p.id !== featured?.id);
    // The legacy default points to a missing asset; use an actual catalogue image.
    const useCatalogue = !content.heroImage || content.heroImage === "/images/hero-1.png";
    const heroImage = useCatalogue
        ? featured?.images[0] || "/images/catalogue-test/abaya.webp"
        : content.heroImage;
    const heroImages = [heroImage, useCatalogue ? detail?.images[0] : undefined];
    return (
        <div className="storefront-home">
            <section className="editorial-hero">
                <div className="hero-copy">
                    <p className="eyebrow">
                        <span /> تفاصيل صغيرة، حضور مختلف
                    </p>
                    <h1>{content.heroTitle}</h1>
                    <p className="hero-description">{content.heroSubtitle}</p>
                    <div className="hero-actions">
                        <ViewLink prefetch={false} href="/shop" className="btn-primary">
                            اكتشفوا المجموعة <ArrowUpLeft size={19} aria-hidden="true" />
                        </ViewLink>
                        <a href="#collections" className="text-link">
                            تصفحوا الفئات
                        </a>
                    </div>
                </div>
                <div className="hero-visual">
                    <div className="hero-primary-photo">
                        <ProductPhoto
                            images={[heroImage, ...(featured?.images ?? [])]}
                            name={
                                useCatalogue && featured
                                    ? featured.nameAr || featured.nameFr
                                    : content.heroTitle
                            }
                            preload
                            sizes="(max-width: 767px) 100vw, 55vw"
                            className="hero-photo"
                        />
                    </div>
                    {useCatalogue && featured && (
                        <ViewLink className="hero-product-tag" href={`/products/${featured.slug}`}>
                            <span>{featured.nameAr || featured.nameFr}</span>
                            <span dir="ltr">{featured.price.toFixed(2)} MAD</span>
                            <ArrowUpLeft size={18} aria-hidden="true" />
                        </ViewLink>
                    )}
                    {useCatalogue && detail?.images[0] && (
                        <ViewLink
                            href={`/products/${detail.slug}`}
                            className="hero-detail-card"
                            aria-label={detail.nameAr || detail.nameFr}
                        >
                            <ProductPhoto
                                images={detail.images}
                                name=""
                                sizes="180px"
                                eager
                                className="object-cover"
                            />
                            <span>{detail.nameAr || detail.nameFr}</span>
                        </ViewLink>
                    )}
                    <span className="hero-image-label" dir="ltr">
                        THE IMAD EDIT
                    </span>
                    <div className="hero-image-caption">
                        <span>أسلوب يناسب الجميع.</span>
                        <span dir="ltr">IMAD / MODE</span>
                    </div>
                </div>
            </section>
            <section id="collections" className="collection-section section-container">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">عالم IMAD</p>
                        <h2>لكل إطلالة، تفاصيلها.</h2>
                    </div>
                    <p className="section-description">
                        ابدؤوا بالفئة التي تفضلونها،
                        <br />
                        واكتشفوا القطع المتوفرة.
                    </p>
                </div>
                <CatalogSectionLinks sections={availableCatalogSections(categories)} newTab={preview} />
                <nav aria-label="فئات المتجر" className="collection-grid">
                    {publishedCategories(categories).map((c) => {
                        const visual = categoryVisual(c, products);
                        return (
                            <ViewLink
                                prefetch={false}
                                className="collection-tile"
                                key={c.id}
                                href={`/shop?category=${c.slug}`}
                            >
                                <span className="collection-photo">
                                    {visual.src ? (
                                        <ProductPhoto
                                            images={visual.sources}
                                            name=""
                                            sizes="96px"
                                            className="object-cover"
                                        />
                                    ) : (
                                        <span className="category-photo-empty" aria-hidden="true">
                                            IMAD
                                        </span>
                                    )}
                                </span>
                                <span className="collection-name">
                                    {c.nameAr || c.nameFr}
                                    <small>{c.publishedCount} منتج</small>
                                </span>
                                <ArrowUpLeft size={22} aria-hidden="true" />
                            </ViewLink>
                        );
                    })}
                </nav>
            </section>
            {!!content.banners.length && (
                <section aria-label="إعلانات المتجر" className="section-container banner-grid">
                    {content.banners.map((banner, i) => (
                        <ViewLink
                            prefetch={false}
                            href={banner.href}
                            key={i}
                            className="campaign-card"
                        >
                            <div className="relative aspect-[2/1]">
                                <ProductPhoto
                                    images={[banner.image]}
                                    name={banner.title}
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    className="object-cover"
                                />
                            </div>
                            <p>
                                {banner.title}
                                <ArrowUpLeft size={20} aria-hidden="true" />
                            </p>
                        </ViewLink>
                    ))}
                </section>
            )}
            <section className="section-container featured-section">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">اختاروا قطعتكم القادمة</p>
                        <h2>{content.featuredTitle}</h2>
                    </div>
                    <ViewLink prefetch={false} href="/shop" className="text-link">
                        كل المنتجات <ArrowUpLeft size={18} aria-hidden="true" />
                    </ViewLink>
                </div>
                {products.length ? (
                    <div className="catalog-grid">
                        {products.map((p) => (
                            <ProductCard
                                product={p}
                                key={p.id}
                                headingLevel={3}
                                thumbnail={!heroImages.includes(p.images[0])}
                                openInNewTab={preview}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty-collection">
                        <h3>مجموعتنا الجديدة قيد التحضير.</h3>
                        <p>تواصلوا معنا للاستفسار عن المنتجات المتوفرة.</p>
                        <ViewLink prefetch={false} href="/contact" className="btn-primary">
                            تواصلوا معنا
                        </ViewLink>
                    </div>
                )}
            </section>
            <details className="shopping-guide section-container home-shopping-guide">
                <summary>كيف تطلبون من IMAD؟</summary>
                <div className="guide-grid">
                    {[
                        ["01", "اكتشفوا", "تصفحوا المجموعة واختاروا القطعة التي تناسبكم."],
                        ["02", "اختاروا", "حددوا اللون والمقاس والكمية المتوفرة."],
                        [
                            "03",
                            "أكملوا طلبكم",
                            "راجعوا الإجمالي وأضيفوا عنوانكم. الدفع عند الاستلام.",
                        ],
                    ].map(([n, title, text]) => (
                        <div key={n}>
                            <span aria-hidden="true">{n}</span>
                            <h3>{title}</h3>
                            <p>{text}</p>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
