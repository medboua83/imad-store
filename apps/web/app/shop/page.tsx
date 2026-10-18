"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { getProducts, type Product } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";

const validId = /^[a-fA-F0-9]{24}$/;
const safeImage = (s: string) => s.startsWith("/") || /^https:\/\/(res\.cloudinary\.com|placeholder\.co)\//.test(s);

function ShopContent() {
  const search = useSearchParams();
  const category = search.get("category") || "all";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const { addItem, items } = useCartStore();
  useEffect(() => {
    let active = true;
    const reset = window.setTimeout(() => {
    setLoading(true);
    setError("");
    }, 0);
    getProducts({limit: 100, status: "ACTIVE", ...(category !== "all" ? {category} : {})})
      .then(r => { if(active) { window.clearTimeout(reset); setProducts(r.data); } })
      .catch(() => { if(active) setError("تعذر تحميل المنتجات. حاول مجدداً."); })
      .finally(() => { if(active) setLoading(false); });
    return () => {active = false; window.clearTimeout(reset);};
  },[category]);
  const filtered = useMemo(() => products.filter(p => [p.nameAr,p.nameFr,p.nameEn].some(n => n.toLowerCase().includes(query.trim().toLowerCase()))),[products,query]);
  return <main className="min-h-screen bg-[#FDFAF6] pt-32 pb-20 px-6" dir="rtl">
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8"><h1 className="text-4xl text-[#1A1A2E]">المتجر</h1><Link href="/checkout" className="flex gap-2 items-center text-sm"><ShoppingBag size={18}/>{items.reduce((n,i)=>n+i.quantity,0)} في السلة</Link></div>
      <input aria-label="البحث عن منتج" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن منتج..." className="border p-3 mb-8 w-full max-w-sm bg-white" />
      {loading ? <p>جارٍ تحميل المنتجات...</p> : error ? <p role="alert">{error}</p> : <><p className="mb-5 text-sm text-gray-500">{filtered.length} منتج</p><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{filtered.map(p=>{
        const variant=p.variants.find(v=>v.stock>0 && validId.test(v.id));
        const active=p.status==="ACTIVE" && validId.test(p.id) && !!variant;
        const img=p.images.find(safeImage);
        return <article key={p.id} className="bg-white shadow-sm"><Link href={`/products/${encodeURIComponent(p.slug)}`} className="relative aspect-[3/4] bg-[#F5EDE0] block">{img ? <Image src={img} alt={p.nameAr || p.nameFr} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover"/> : <span className="absolute inset-0 flex items-center justify-center text-gray-400">لا توجد صورة</span>}</Link><div className="p-5"><Link href={`/products/${encodeURIComponent(p.slug)}`} className="block text-lg mb-3 hover:underline">{p.nameAr || p.nameFr || p.nameEn}</Link><p className="mb-4">{p.price.toLocaleString()} MAD</p><button type="button" disabled={!active} onClick={()=>{if(variant) addItem(p,variant,1);}} className="w-full py-3 bg-[#1A1A2E] text-white disabled:opacity-40">{active ? "أضف إلى السلة" : "غير متوفر"}</button></div></article>;
      })}</div>{filtered.length===0 && <div className="mt-8 space-y-3"><p>{query ? "لا توجد منتجات مطابقة لبحثك" : "نعمل على تجهيز مجموعتنا الجديدة. تواصلوا معنا للاستفسار عن المنتجات المتوفرة."}</p><Link href="/contact" className="underline">تواصل معنا</Link></div>}</>}
    </div>
  </main>;
}
export default function ShopPage() { return <Suspense fallback={<main className="pt-40 text-center">جارٍ التحميل...</main>}><ShopContent/></Suspense>; }
