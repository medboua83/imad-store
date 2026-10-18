import Image from "next/image";
import Link from "next/link";
import type { SiteContent } from "@imad-store/shared";
import type { Product, Category } from "@/lib/api";
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
    return (
        <div>
            <section className="hero-section">
                <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6 items-center">
                    <div className="p-6 md:p-10 space-y-5">
                        <p className="tracking-widest">IMAD MODE</p>
                        <h1 className="text-4xl md:text-6xl leading-snug">{content.heroTitle}</h1>
                        <p className="text-lg leading-8 max-w-xl">{content.heroSubtitle}</p>
                        <Link prefetch={false} href="/shop" className="btn-primary">
                            اكتشفي المتجر
                        </Link>
                        <Link prefetch={false} href="/delivery" className="action block underline">
                            تعرفي على التوصيل
                        </Link>
                    </div>
                    <div className="relative h-56 md:h-[460px]">
                        <Image
                            src={content.heroImage}
                            alt={content.heroTitle}
                            fill
                            priority
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover md:rounded-2xl"
                        />
                    </div>
                </div>
            </section>
            <section className="max-w-7xl mx-auto px-5 py-8">
                <h2 className="text-2xl mb-4">تسوقي حسب الفئة</h2>
                <nav aria-label="فئات المتجر" className="flex flex-wrap gap-3">
                    {categories.map((c) => (
                        <Link
                            prefetch={false}
                            className="action rounded-full border px-5 bg-white"
                            key={c.id}
                            href={`/shop?category=${c.slug}`}
                        >
                            {c.nameAr || c.nameFr}
                        </Link>
                    ))}
                </nav>
            </section>
            {!!content.banners.length && (
                <section
                    aria-label="إعلانات المتجر"
                    className="max-w-7xl mx-auto p-5 grid md:grid-cols-3 gap-4"
                >
                    {content.banners.map((banner, i) => (
                        <Link
                            prefetch={false}
                            href={banner.href}
                            key={i}
                            className="border rounded-xl overflow-hidden bg-white"
                        >
                            <div className="relative aspect-[2/1]">
                                <Image
                                    src={banner.image}
                                    alt={banner.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    className="object-cover"
                                />
                            </div>
                            <p className="p-4 text-lg">{banner.title}</p>
                        </Link>
                    ))}
                </section>
            )}
            <section className="max-w-7xl mx-auto px-5 py-10">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <h2 className="text-3xl">{content.featuredTitle}</h2>
                    <Link prefetch={false} href="/shop" className="action underline">
                        عرض جميع المنتجات
                    </Link>
                </div>
                {products.length ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {products.map((p) => (
                            <ProductCard product={p} key={p.id} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border p-8 bg-white space-y-4">
                        <p>نعمل على تجهيز مجموعتنا الجديدة.</p>
                        <p>تواصلي معنا للاستفسار عن المنتجات المتوفرة.</p>
                        <Link prefetch={false} href="/contact" className="btn-primary">
                            تواصل معنا
                        </Link>
                    </div>
                )}
            </section>
        </div>
    );
}
