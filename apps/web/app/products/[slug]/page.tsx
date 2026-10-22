import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGallery } from "@/components/store/ProductGallery";
import { PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { publicProduct, requestSiteOrigin } from "@/lib/server-api";
import { ProductOptions } from "@/components/store/ProductOptions";
import { productShareMetadata } from "@/lib/share-metadata";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await publicProduct(slug);
  if (!product) notFound();
  return productShareMetadata(product, await requestSiteOrigin());
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await publicProduct(slug);
  if (!product) notFound();
  const origin = await requestSiteOrigin();
  const name = product.nameAr || product.nameFr;
  const inStock = product.variants.some((v) => v.stock > 0);
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: product.descriptionAr || product.descriptionFr,
    image: product.images.map((image) => new URL(image, origin).toString()),
    sku: product.variants[0]?.sku,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "MAD",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/products/${slug}`, origin).toString(),
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
        <div className="product-detail refined-detail">
          <div className="product-identity">
            <Link
              className="product-category-label"
              href={`/shop?category=${product.category.slug}`}
            >
              {product.category.nameAr || product.category.nameFr}
            </Link>
            <h1>{name}</h1>
            {product.freeShipping && (
              <p className="product-shipping-badge">التوصيل مجاني لهذا المنتج</p>
            )}
            <div className="product-price-row">
              {product.compareAtPrice && product.compareAtPrice > product.price ? (
                <del>{product.compareAtPrice.toFixed(2)} MAD</del>
              ) : null}
              <p dir="ltr">
                {product.price.toFixed(2)} <span>MAD</span>
              </p>
              <span className="product-stock-label">
                {inStock ? "متوفر الآن" : "غير متوفر حالياً"}
              </span>
            </div>
            <div className="product-service-note">
              <PackageCheck size={17} aria-hidden="true" />
              <span>الدفع عند الاستلام · بدون إنشاء حساب</span>
            </div>
          </div>
          <ProductOptions product={product} />
          <div className="product-information">
            <details open>
              <summary>تفاصيل القطعة</summary>
              <p className="product-description">
                {product.descriptionAr ||
                  product.descriptionFr ||
                  product.descriptionEn ||
                  "تواصلوا معنا لمزيد من التفاصيل حول هذه القطعة."}
              </p>
            </details>
            <details>
              <summary>التوصيل والاستبدال</summary>
              <p>راجعوا رسوم التوصيل وشروط المتجر قبل تأكيد طلبكم.</p>
              <nav aria-label="معلومات التوصيل والاستبدال">
                <Link href="/delivery">
                  <Truck size={17} aria-hidden="true" />
                  معلومات التوصيل
                </Link>
                <Link href="/returns">الاستبدال والإرجاع</Link>
              </nav>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
