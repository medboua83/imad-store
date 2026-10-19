import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGallery } from "@/components/store/ProductGallery";
import { PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { publicProduct, siteOrigin } from "@/lib/server-api";
import { ProductOptions } from "@/components/store/ProductOptions";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const product = await publicProduct(slug);
    if (!product) notFound();
    return {
        title: product.nameAr || product.nameFr,
        description: (product.descriptionAr || product.descriptionFr || product.nameFr).slice(
            0,
            160,
        ),
        alternates: { canonical: `/products/${slug}` },
        openGraph: { title: product.nameAr || product.nameFr, images: product.images.slice(0, 1) },
    };
}
export default async function ProductPage({ params }: Props) {
    const { slug } = await params;
    const product = await publicProduct(slug);
    if (!product) notFound();
    const name = product.nameAr || product.nameFr;
    const inStock = product.variants.some((v) => v.stock > 0);
    const structured = {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description: product.descriptionAr || product.descriptionFr,
        image: product.images.map((image) => new URL(image, siteOrigin()).toString()),
        sku: product.variants[0]?.sku,
        offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "MAD",
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: new URL(`/products/${slug}`, siteOrigin()).toString(),
        },
    };
    return (
        <section className="page-shell product-page">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
                }}
            />
            <nav aria-label="مسار التصفح" className="mb-7">
                <Link className="underline" href="/shop">
                    المتجر
                </Link>{" "}
                / {name}
            </nav>
            <div className="product-layout">
                <ProductGallery images={product.images} name={name} />
                <div className="space-y-6 product-detail">
                    <p>{product.category.nameAr || product.category.nameFr}</p>
                    <h1 className="text-4xl">{name}</h1>
                    <p className="text-2xl">{product.price.toFixed(2)} MAD</p>
                    <p className="whitespace-pre-line leading-8">
                        {product.descriptionAr || product.descriptionFr || product.descriptionEn}
                    </p>
                    <div className="product-service-note">
                        <PackageCheck size={20} aria-hidden="true" />
                        <span>الدفع عند الاستلام · بدون إنشاء حساب</span>
                    </div>
                    <ProductOptions product={product} />
                    <nav className="flex gap-5 flex-wrap">
                        <Link className="underline action" href="/delivery">
                            التوصيل
                        </Link>
                        <Link className="underline action" href="/returns">
                            الاستبدال والإرجاع
                        </Link>
                    </nav>
                    <div className="product-delivery-note">
                        <Truck size={19} aria-hidden="true" />
                        <p>راجعي رسوم التوصيل وشروط المتجر قبل تأكيد طلبكِ.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
