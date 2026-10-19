import Link from "next/link";
import type { Metadata } from "next";
import { publicProducts, publicCategories } from "@/lib/server-api";
import { SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/store/ProductCard";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "المتجر",
    description: "تصفحي المنتجات حسب الفئة والسعر والتوفر.",
    alternates: { canonical: "/shop" },
};
export default async function ShopPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const raw = await searchParams;
    const value = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
    const params: Record<string, string | number> = { limit: 12 };
    for (const key of ["search", "category", "sort", "minPrice", "maxPrice", "availability"]) {
        const v = value(key);
        if (v) params[key] = v;
    }
    const page = Number(value("page") || 1);
    params.page = Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
    let result;
    let invalid = false;
    try {
        result = await publicProducts(params);
    } catch {
        if (Object.keys(params).length > 2) {
            invalid = true;
            result = await publicProducts({ page: 1, limit: 12 });
        } else throw new Error("Store unavailable");
    }
    const categories = await publicCategories();
    const pageLink = (page: number) => {
        const query = new URLSearchParams();
        for (const [key, v] of Object.entries(params)) query.set(key, String(v));
        query.set("page", String(page));
        return `/shop?${query}`;
    };
    return (
        <section className="page-shell shop-page">
            <div className="shop-intro">
                <p className="eyebrow">THE IMAD EDIT</p>
                <h1>اكتشفي ما يشبهكِ.</h1>
                <p>كل القطع، في مكان واحد. اختاري الفئة والتفاصيل التي تناسبكِ.</p>
            </div>
            <nav className="shop-category-rail" aria-label="تصفح حسب الفئة">
                <Link href="/shop" aria-current={!value("category") ? "page" : undefined}>
                    كل القطع
                </Link>
                {categories.map((c) => (
                    <Link
                        key={c.id}
                        href={`/shop?category=${c.slug}`}
                        aria-current={value("category") === c.slug ? "page" : undefined}
                    >
                        {c.nameAr || c.nameFr}
                    </Link>
                ))}
            </nav>
            <details
                id="catalog-search"
                className="filter-panel"
                open={
                    !!(
                        value("filters") === "open" ||
                        value("search") ||
                        value("minPrice") ||
                        value("maxPrice") ||
                        value("availability") ||
                        value("sort")
                    )
                }
            >
                <summary>
                    <SlidersHorizontal size={18} aria-hidden="true" />
                    <span>البحث والتصفية</span>
                    <span className="filter-result-count">{result.total} منتج</span>
                </summary>
                <form
                    key={JSON.stringify(params)}
                    action="/shop"
                    method="get"
                    className="shop-filters grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
                >
                    <label className="col-span-2 sm:col-span-1">
                        البحث عن منتج
                        <input
                            className="store-input mt-2"
                            type="search"
                            name="search"
                            maxLength={120}
                            defaultValue={value("search")}
                            placeholder="بالعربية، français, English"
                        />
                    </label>
                    <label className="col-span-2 sm:col-span-1">
                        الفئة
                        <select
                            className="store-input mt-2"
                            name="category"
                            defaultValue={value("category")}
                        >
                            <option value="">جميع الفئات</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.slug}>
                                    {c.nameAr || c.nameFr}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="btn-primary self-end" type="submit">
                        تطبيق الفلاتر
                    </button>
                    <Link className="action self-end underline" href="/shop">
                        مسح الفلاتر
                    </Link>
                    <details
                        className="col-span-2 lg:col-span-4 border-t pt-3"
                        open={
                            !!(
                                (value("sort") && value("sort") !== "newest") ||
                                (value("availability") && value("availability") !== "all") ||
                                value("minPrice") ||
                                value("maxPrice")
                            )
                        }
                    >
                        <summary className="action cursor-pointer">الترتيب والسعر والتوفر</summary>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                            {" "}
                            <label>
                                الترتيب
                                <select
                                    className="store-input mt-2"
                                    name="sort"
                                    defaultValue={value("sort") || "newest"}
                                >
                                    <option value="newest">الأحدث</option>
                                    <option value="price-asc">السعر: من الأقل</option>
                                    <option value="price-desc">السعر: من الأعلى</option>
                                    <option value="name">الاسم</option>
                                </select>
                            </label>
                            <label>
                                التوفر
                                <select
                                    className="store-input mt-2"
                                    name="availability"
                                    defaultValue={value("availability") || "all"}
                                >
                                    <option value="all">جميع المنتجات</option>
                                    <option value="in-stock">المتوفر فقط</option>
                                </select>
                            </label>
                            <label>
                                أقل سعر (MAD)
                                <input
                                    className="store-input mt-2"
                                    type="number"
                                    name="minPrice"
                                    min="0"
                                    max="1000000"
                                    defaultValue={value("minPrice")}
                                />
                            </label>
                            <label>
                                أعلى سعر (MAD)
                                <input
                                    className="store-input mt-2"
                                    type="number"
                                    name="maxPrice"
                                    min="0"
                                    max="1000000"
                                    defaultValue={value("maxPrice")}
                                />
                            </label>
                        </div>
                    </details>
                </form>
            </details>
            {invalid && (
                <p role="alert" className="mb-6">
                    بعض الفلاتر غير صالحة. تم عرض المجموعة الكاملة.
                </p>
            )}
            <p className="mb-5" role="status">
                {result.total} منتج — الصفحة {result.page} من {Math.max(1, result.totalPages)}
            </p>
            {result.data.length ? (
                <div className="catalog-grid">
                    {result.data.map((p) => (
                        <ProductCard product={p} key={p.id} />
                    ))}
                </div>
            ) : (
                <div className="space-y-4 py-10">
                    <p>
                        {value("search") || value("category")
                            ? "لا توجد منتجات مطابقة. جربي تغيير الفلاتر."
                            : "نعمل على تجهيز مجموعتنا الجديدة."}
                    </p>
                    <Link className="action underline" href="/contact">
                        تواصل معنا
                    </Link>
                </div>
            )}
            {result.totalPages > 1 && (
                <nav aria-label="صفحات المنتجات" className="flex flex-wrap items-center gap-4 mt-8">
                    {result.page > 1 && (
                        <Link
                            className="action border rounded px-5"
                            href={pageLink(result.page - 1)}
                        >
                            الصفحة السابقة
                        </Link>
                    )}
                    {result.page < result.totalPages && (
                        <Link
                            className="action border rounded px-5"
                            href={pageLink(result.page + 1)}
                        >
                            الصفحة التالية
                        </Link>
                    )}
                </nav>
            )}
        </section>
    );
}
