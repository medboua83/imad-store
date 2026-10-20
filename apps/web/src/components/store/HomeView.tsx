import { ProductPhoto } from "./ProductPhoto";
import Link from "next/link";
import { ArrowUpLeft, PackageCheck, SlidersHorizontal, Truck } from "lucide-react";
import type { SiteContent } from "@imad-store/shared";
import type { Product, Category } from "@/lib/api";
import { categoryVisual } from "./category-visuals";
import { ProductCard } from "./ProductCard";
export function HomeView({
    content,
    products,
    categories,
}: {
    content: SiteContent;
    products: Product[];
    categories: Category[];
}) {
    const featured = products.find((p) => p.category?.slug === "abayas") || products[0];
    const detail =
        products.find((p) => p.category?.slug === "shawls") ||
        products.find((p) => p.id !== featured?.id);
    // The legacy default points to a missing asset; use an actual catalogue image.
    const useCatalogue = !content.heroImage || content.heroImage === "/images/hero-1.png";
    const heroImage = useCatalogue
        ? featured?.images[0] || "/images/catalogue-test/abaya.webp"
        : content.heroImage;
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
                        <Link prefetch={false} href="/shop" className="btn-primary">
                            اكتشفوا المجموعة <ArrowUpLeft size={19} aria-hidden="true" />
                        </Link>
                        <Link href="#collections" className="text-link">
                            تصفحوا الفئات
                        </Link>
                    </div>
                    <div className="hero-note">
                        <span className="hero-note-line" />
                        <p>
                            اختاروا ما يشبهكم.
                            <br />
                            <span>من القطعة الأولى إلى اللمسة الأخيرة.</span>
                        </p>
                    </div>
                </div>
                <div className="hero-visual">
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
                    {useCatalogue && featured && (
                        <Link className="hero-product-tag" href={`/products/${featured.slug}`}>
                            <span>{featured.nameAr || featured.nameFr}</span>
                            <span dir="ltr">{featured.price.toFixed(2)} MAD</span>
                            <ArrowUpLeft size={18} aria-hidden="true" />
                        </Link>
                    )}
                    {useCatalogue && detail?.images[0] && (
                        <Link
                            href={`/products/${detail.slug}`}
                            className="hero-detail-card"
                            aria-label={detail.nameAr || detail.nameFr}
                        >
                            <ProductPhoto
                                images={detail.images}
                                name=""
                                sizes="180px"
                                className="object-cover"
                            />
                            <span>
                                التفاصيل تصنع الفرق <ArrowUpLeft size={16} aria-hidden="true" />
                            </span>
                        </Link>
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
            <div className="service-strip" aria-label="تجربة التسوق">
                <div>
                    <PackageCheck size={23} aria-hidden="true" />
                    <p>
                        الدفع عند الاستلام<span>أكملوا طلبكم دون إنشاء حساب</span>
                    </p>
                </div>
                <div>
                    <SlidersHorizontal size={23} aria-hidden="true" />
                    <p>
                        اختيارات على مقاسكم<span>اللون، المقاس والتوفر في كل قطعة</span>
                    </p>
                </div>
                <Link href="/delivery">
                    <Truck size={23} aria-hidden="true" />
                    <p>
                        تفاصيل واضحة<span>رسوم التوصيل قبل تأكيد الطلب</span>
                    </p>
                    <ArrowUpLeft size={17} aria-hidden="true" />
                </Link>
            </div>
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
                <nav aria-label="فئات المتجر" className="collection-grid">
                    {categories.map((c) => {
                        const visual = categoryVisual(c, products);
                        return (
                            <Link
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
                                    {c.nameAr && c.nameAr !== c.nameFr && (
                                        <small dir="ltr">{c.nameFr}</small>
                                    )}
                                </span>
                                <ArrowUpLeft size={22} aria-hidden="true" />
                            </Link>
                        );
                    })}
                </nav>
            </section>
            {!!content.banners.length && (
                <section aria-label="إعلانات المتجر" className="section-container banner-grid">
                    {content.banners.map((banner, i) => (
                        <Link prefetch={false} href={banner.href} key={i} className="campaign-card">
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
                        </Link>
                    ))}
                </section>
            )}
            <section className="section-container featured-section">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">اختاروا قطعتكم القادمة</p>
                        <h2>{content.featuredTitle}</h2>
                    </div>
                    <Link prefetch={false} href="/shop" className="text-link">
                        كل المنتجات <ArrowUpLeft size={18} aria-hidden="true" />
                    </Link>
                </div>
                {products.length ? (
                    <div className="catalog-grid">
                        {products.map((p) => (
                            <ProductCard product={p} key={p.id} headingLevel={3} />
                        ))}
                    </div>
                ) : (
                    <div className="empty-collection">
                        <h3>مجموعتنا الجديدة قيد التحضير.</h3>
                        <p>تواصلوا معنا للاستفسار عن المنتجات المتوفرة.</p>
                        <Link prefetch={false} href="/contact" className="btn-primary">
                            تواصلوا معنا
                        </Link>
                    </div>
                )}
            </section>
            <section className="shopping-guide section-container">
                <p className="eyebrow">من الاختيار إلى الطلب</p>
                <h2>تجربة بسيطة، من أجلكم.</h2>
                <div className="guide-grid">
                    {[
                        ["01", "اكتشفوا", "تصفحوا المجموعة واختاروا القطعة التي تناسبكم."],
                        ["02", "اختاروا", "حددوا اللون والمقاس والكمية المتوفرة."],
                        ["03", "أكملوا طلبكم", "راجعوا الإجمالي وأضيفوا عنوانكم. الدفع عند الاستلام."],
                    ].map(([n, title, text]) => (
                        <div key={n}>
                            <span aria-hidden="true">{n}</span>
                            <h3>{title}</h3>
                            <p>{text}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
