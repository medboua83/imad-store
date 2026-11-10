import { ProductPhoto } from "./ProductPhoto";
import Link from "next/link";
import { Fragment, type ComponentProps, type ReactNode } from "react";
import { ArrowDown, ArrowUpLeft } from "lucide-react";
import { homeSectionKeys, type HomeSection, type SiteContent } from "@imad-store/shared";
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
    const featured =
        products.find((product) => product.category?.slug === "abayas" && product.images[0]) ||
        products.find((product) => product.images[0]);
    // The legacy default points to a missing asset.
    const useCatalogue = !content.heroImage || content.heroImage === "/images/hero-1.png";
    const catalogueImages = featured?.images ?? ["/images/catalogue-test/abaya.webp"];
    const heroImages = useCatalogue ? catalogueImages : [content.heroImage, ...catalogueImages];
    const homeSections = content.homeSections ?? homeSectionKeys;
    const blocks: Record<HomeSection, ReactNode> = {
        collections: (
            <section
                id="collections"
                className="collection-section section-container"
                aria-labelledby="home-collections-title"
                tabIndex={-1}
            >
                <div className="section-heading">
                    <h2 id="home-collections-title">تسوقوا حسب الفئة</h2>
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
                                            sizes="(max-width: 359px) 48px, 56px"
                                        />
                                    ) : (
                                        <span className="category-photo-empty" aria-hidden="true">
                                            IMAD
                                        </span>
                                    )}
                                </span>
                                <span className="collection-name">
                                    <span>{c.nameAr || c.nameFr}</span>
                                    <ArrowUpLeft size={16} aria-hidden="true" />
                                </span>
                            </ViewLink>
                        );
                    })}
                </nav>
            </section>
        ),
        featured: (
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
                                thumbnail={heroImages[0] !== p.images[0]}
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
        ),
        banners: content.banners.length ? (
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
        ) : null,
        guide: (
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
        ),
    };
    return (
        <div className="storefront-home">
            <section className="editorial-hero">
                <div className="hero-copy">
                    <h1>{content.heroTitle}</h1>
                    <p className="hero-description">{content.heroSubtitle}</p>
                    <div className="hero-actions">
                        {homeSections.includes("collections") ? (
                            <a href="#collections" className="btn-primary">
                                تصفحوا المجموعة <ArrowDown size={16} aria-hidden="true" />
                            </a>
                        ) : (
                            <ViewLink href="/shop" className="btn-primary">
                                تصفحوا المجموعة <ArrowUpLeft size={16} aria-hidden="true" />
                            </ViewLink>
                        )}
                    </div>
                </div>
                <div className="hero-visual">
                    <ProductPhoto
                        images={heroImages}
                        name={useCatalogue && featured ? featured.nameAr || featured.nameFr : ""}
                        preload
                        sizes="(max-width: 767px) calc(45vw - 12px), 336px"
                        className="hero-photo"
                    />
                </div>
            </section>
            {homeSections.map((section) => (
                <Fragment key={section}>{blocks[section]}</Fragment>
            ))}
        </div>
    );
}
