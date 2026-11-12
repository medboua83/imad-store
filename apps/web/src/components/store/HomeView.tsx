import { ProductPhoto } from "./ProductPhoto";
import Link from "next/link";
import { Fragment, type ComponentProps, type ReactNode } from "react";
import { ArrowUpLeft } from "lucide-react";
import {
    homeSectionKeys,
    MAX_HERO_PRODUCTS,
    usesManualHeroSelection,
    type HomeSection,
    type SiteContent,
} from "@imad-store/shared";
import type { Product, Category } from "@/lib/api";
import { categoryVisual } from "./category-visuals";
import { ProductCard } from "./ProductCard";
import { availableCatalogSections, publishedCategories } from "@/lib/catalog-navigation";
import { CatalogSectionLinks } from "./CatalogSectionLinks";
import { HomeHero, type HeroSlide } from "./HomeHero";
import { sellableVariants } from "@/lib/product-presentation";
import { isAvailableHeroProduct } from "@/lib/hero-selection";
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
    heroProducts = [],
    preview = false,
}: {
    content: SiteContent;
    products: Product[];
    categories: Category[];
    heroProducts?: Product[];
    preview?: boolean;
}) {
    const ViewLink = preview ? DraftPreviewLink : Link;
    const available = products.filter(isAvailableHeroProduct);
    const featured =
        available.find((product) => product.category?.slug === "abayas") || available[0];
    // The legacy default points to a missing asset.
    const useCatalogue = !content.heroImage || content.heroImage === "/images/hero-1.png";
    const catalogueImages = featured?.images ?? ["/images/catalogue-test/abaya.webp"];
    const heroImages = useCatalogue ? catalogueImages : [content.heroImage, ...catalogueImages];
    const automaticProducts = [featured, ...available].filter(
        (product, index, list): product is Product =>
            Boolean(product?.images[0]) &&
            list.findIndex((entry) => entry?.id === product?.id) === index,
    );
    const manual = usesManualHeroSelection(content);
    const selected = manual
        ? (content.heroProductIds ?? []).flatMap((id) => {
              const product = heroProducts.find((p) => p.id === id && isAvailableHeroProduct(p));
              return product ? [product] : [];
          })
        : automaticProducts;
    const productSlides: HeroSlide[] = selected.map((product) => ({
        id: product.id,
        images: product.images,
        name: product.nameAr || product.nameFr,
        href: `/products/${product.slug}`,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        description: (product.descriptionAr || product.descriptionFr || product.descriptionEn || "")
            .replace(/\s+/g, " ")
            .trim(),
        colors: [
            ...new Map(
                sellableVariants(product.variants)
                    .filter((v) => v.stock > 0)
                    .map((v) => [
                        v.color.trim().toLowerCase(),
                        {
                            value: v.color.trim(),
                            label: v.colorNameAr || v.colorNameFr || v.colorNameEn || v.color,
                        },
                    ]),
            ).values(),
        ],
    }));
    const slides: HeroSlide[] = (
        (manual || useCatalogue) && productSlides.length
            ? productSlides
            : [
                  {
                      id: "collection",
                      images: manual ? (useCatalogue ? [] : [content.heroImage]) : heroImages,
                      name: "اكتشفوا مجموعة IMAD Mode",
                      href: "/shop",
                  },
                  ...productSlides,
              ]
    ).slice(0, manual ? MAX_HERO_PRODUCTS : 4);
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
                <CatalogSectionLinks
                    sections={availableCatalogSections(categories)}
                    newTab={preview}
                />
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
                                thumbnail={slides[0]?.images[0] !== p.images[0]}
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
                    <ViewLink prefetch={false} href={banner.href} key={i} className="campaign-card">
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
            <HomeHero
                key={slides.map((slide) => slide.id).join("|")}
                slides={slides}
                brand={content.businessName || "IMAD Mode"}
                collectionHref={homeSections.includes("collections") ? "#collections" : "/shop"}
                preview={preview}
                autoplay={content.heroAutoplay ?? true}
                minimalControls={content.heroMinimalControls ?? true}
            >
                <div className="hero-copy">
                    <p className="hero-eyebrow">
                        <span aria-hidden="true" />
                        <bdi>{content.businessName || "IMAD Mode"}</bdi>
                    </p>
                    <h1>{content.heroTitle}</h1>
                    <p className="hero-description">{content.heroSubtitle}</p>
                    <div className="hero-actions">
                        <ViewLink href="/shop" className="btn-primary hero-product-link">
                            تصفحوا المجموعة <ArrowUpLeft size={16} aria-hidden="true" />
                        </ViewLink>
                    </div>
                </div>
            </HomeHero>
            {homeSections.map((section) => (
                <Fragment key={section}>{blocks[section]}</Fragment>
            ))}
        </div>
    );
}
