"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Minus, Plus } from "lucide-react";
import { getProduct, type Product, type ProductVariant } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";

const objectId = /^[a-fA-F0-9]{24}$/;
const imgSafe = (value: string) => value.startsWith("/") || /^https:\/\/(res\.cloudinary\.com|placeholder\.co)\//.test(value);

export default function ProductDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);
  const [imageIdx, setImageIdx] = useState(0);
  const { addItem } = useCartStore();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProduct(null);
    setVariantId("");
    setError("");
    getProduct(slug).then(p => {
      if (!active) return;
      if (p.status !== "ACTIVE") { setError("هذا المنتج غير متاح حالياً"); return; }
      setProduct(p);
      setVariantId(p.variants.find(v => v.stock > 0 && objectId.test(v.id))?.id || "");
    }).catch(() => { if (active) setError("تعذر تحميل المنتج. حاول مجدداً."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const variant: ProductVariant | undefined = product?.variants.find(v => v.id === variantId);
  const available = !!product && objectId.test(product.id) && !!variant && objectId.test(variant.id) && variant.stock > 0;
  const maxQty = variant?.stock ?? 1;
  const images = (product?.images || []).filter(imgSafe);
  const name = product?.nameAr || product?.nameFr || product?.nameEn || "";

  function add() {
    if (!product || !variant || !available || qty < 1 || qty > variant.stock) return;
    addItem(product, variant, qty);
  }

  if (loading) return <main className="min-h-[70vh] pt-36 px-6 text-center" dir="rtl">جارٍ تحميل المنتج...</main>;
  if (!product || error) return <main className="min-h-[70vh] pt-36 px-6 text-center" dir="rtl"><p>{error || "المنتج غير موجود"}</p><Link href="/shop" className="underline mt-6 inline-block">العودة إلى المتجر</Link></main>;

  return (
    <main className="min-h-screen bg-[#FDFAF6] pt-32 pb-20 px-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <nav className="text-xs text-[#8B8399] mb-10"><Link href="/shop" className="hover:underline">المتجر</Link> / {name}</nav>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <section>
            <div className="relative aspect-[4/5] bg-[#F5EDE0] overflow-hidden">
              {images[imageIdx] ? <Image src={images[imageIdx]} alt={name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority /> : <div className="flex h-full items-center justify-center text-[#8B8399]">لا توجد صورة</div>}
            </div>
            {images.length > 1 && <div className="flex gap-3 mt-3">{images.map((image,i) => <button key={i} type="button" onClick={() => setImageIdx(i)} className={`w-20 h-24 relative border-2 ${imageIdx === i ? "border-[#C9A96E]" : "border-transparent"}`}><Image src={image} alt={`${name} ${i+1}`} fill sizes="80px" className="object-cover" /></button>)}</div>}
          </section>
          <section className="flex flex-col gap-6 lg:pt-6">
            <p className="text-[#C9A96E] text-sm">{product.category?.nameAr || product.category?.nameFr || ""}</p>
            <h1 className="text-4xl text-[#1A1A2E]">{name}</h1>
            <p className="text-3xl">{product.price.toLocaleString()} MAD {product.compareAtPrice && product.compareAtPrice > product.price ? <span className="text-base line-through text-gray-400">{product.compareAtPrice.toLocaleString()} MAD</span> : null}</p>
            <p className="text-sm leading-7 text-gray-600">{product.descriptionAr || product.descriptionFr || product.descriptionEn}</p>
            <div><label htmlFor="variant" className="block mb-3 text-sm">اللون / المقاس</label><select id="variant" value={variantId} onChange={e => { setVariantId(e.target.value); setQty(1); }} className="border border-[#C9A96E]/40 bg-white p-3 w-full"><option value="">اختر النوع</option>{product.variants.map(v => <option key={v.id} value={v.id} disabled={v.stock <= 0 || !objectId.test(v.id)}>{v.colorNameAr || v.colorNameFr || v.color} {v.size ? `— ${v.size}` : ""} {v.stock <= 0 ? "— نفدت الكمية" : `— ${v.stock} متوفر`}</option>)}</select></div>
            <div className="flex items-center gap-3"><button type="button" aria-label="تقليل الكمية" className="border p-3" onClick={() => setQty(q => Math.max(1,q-1))}><Minus size={16}/></button><span>{qty}</span><button type="button" aria-label="زيادة الكمية" className="border p-3" onClick={() => setQty(q => Math.min(maxQty, q+1))}><Plus size={16}/></button></div>
            <button type="button" onClick={add} disabled={!available || qty > maxQty} className="flex gap-3 items-center justify-center py-4 bg-[#1A1A2E] text-white disabled:opacity-40"><ShoppingBag size={18}/>{available ? "أضف إلى السلة" : "غير متوفر"}</button>
            <p className="text-xs text-gray-500">SKU: {variant?.sku || "—"}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
