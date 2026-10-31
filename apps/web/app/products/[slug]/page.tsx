import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGallery } from "@/components/store/ProductGallery";
import { Suspense } from "react";
import { ProductSuggestions } from "@/components/store/ProductSuggestions";
import { PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { publicProduct, publicSettings, requestSiteOrigin } from "@/lib/server-api";
import { productDescription, descriptionParagraphs, sellableVariants, orderedSizes } from "@/lib/product-presentation";
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
  const variants = sellableVariants(product.variants);
  const inStock = variants.some((v) => v.stock > 0);
  const settings = await publicSettings();
  const description = productDescription(product);
  const colors = [...new Set(variants.map(v => v.colorNameAr || v.colorNameFr || v.colorNameEn).filter(Boolean))];
  const sizes = orderedSizes(variants).filter(Boolean);
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: product.images.map((image) => new URL(image, origin).toString()),
    sku: variants[0]?.sku,
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
        <ProductGallery key={product.id} images={product.images} name={name} />
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
              <span>{settings.codEnabled ? "الدفع عند الاستلام · بدون إنشاء حساب" : "راجعوا طرق الدفع المتاحة مع المتجر"}</span>
            </div>
          </div>
          <ProductOptions key={product.id} product={product} />
          <div className="product-information">
            <details open>
              <summary>تفاصيل القطعة</summary>
              <dl className="product-facts">
                <div><dt>الفئة</dt><dd>{product.category.nameAr || product.category.nameFr}</dd></div>
                {!!colors.length && <div><dt>الألوان</dt><dd>{colors.join(" · ")}</dd></div>}
                {!!sizes.length && <div><dt>المقاسات</dt><dd><bdi>{sizes.join(" · ")}</bdi></dd></div>}
              </dl>
              {descriptionParagraphs(description).map((paragraph, index) => <p key={index} className="product-description" dir="auto">{paragraph}</p>)}
            </details>
            <details>
              <summary>التوصيل والاستبدال</summary>
              <p>{product.freeShipping ? "التوصيل مجاني عند إضافة هذا المنتج إلى السلة." : `رسوم التوصيل ${settings.shippingCost.toFixed(2)} MAD، وتصبح مجانية من ${settings.freeShippingMin.toFixed(2)} MAD أو عند إضافة منتج مؤهل.`}</p>
              {settings.deliveryMaxDays && <p>التوصيل خلال {settings.deliveryMaxDays} أيام كحد أقصى.</p>}
              {settings.returnWindowDays && <p>طلب الاستبدال أو الإرجاع خلال {settings.returnWindowDays} أيام من الاستلام.</p>}
              {settings.returnFeePayer === "STORE" && <p>يتحمل المتجر رسوم الشحن الخاصة بالإرجاع.</p>}
              {settings.returnFeePayer === "DELIVERY_TRY_ON" && <p>الإرجاع المؤكد أثناء التجربة عند التسليم على حساب المتجر. بعد الدفع ومغادرة المندوب، يتحمل العميل رسوم الإرجاع ضمن المدة المحددة.</p>}
              <p>تُحسب الرسوم النهائية في ملخص الطلب. راجعوا آجال التوصيل وشروط الاستبدال والإرجاع قبل تأكيد طلبكم.</p>
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
      <Suspense fallback={null}><ProductSuggestions slug={slug} /></Suspense>
    </section>
  );
}
