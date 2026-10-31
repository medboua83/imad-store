import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { publicProducts, publicCategories, requestSiteOrigin } from "@/lib/server-api";
import { storefrontShareMetadata } from "@/lib/share-metadata";
import { ArrowUpLeft, Check, LayoutGrid, Search, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/store/ProductCard";
import { categoryThumbnail } from "@/components/store/category-visuals";
import { publishedCategories } from "@/lib/catalog-navigation";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
    return storefrontShareMetadata("shop", await requestSiteOrigin());
}
const filterKeys = ["search", "category", "sort", "minPrice", "maxPrice", "availability"] as const;
const sortLabels: Record<string, string> = {
    newest: "الأحدث",
    "price-asc": "السعر: من الأقل",
    "price-desc": "السعر: من الأعلى",
    name: "الاسم",
};
export default async function ShopPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const raw = await searchParams;
    const value = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
    const params: Record<string, string | number> = { limit: 12 };
    for (const key of filterKeys) if (value(key)) params[key] = value(key);
    const page = Number(value("page") || 1);
    params.page = Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
    const categories = await publicCategories();
    let result;
    let invalid = false;
    try {
        result = await publicProducts(params);
    } catch (error) {
        // Only invalid filter input falls back. An upstream outage must remain an error.
        if (error instanceof Error && error.message.endsWith("(400)")) {
            invalid = true;
            result = await publicProducts({ page: 1, limit: 12 });
        } else throw error;
    }
    const queryLink = (changes: Record<string, string | number | null> = {}) => {
        const query = new URLSearchParams();
        for (const key of filterKeys) if (value(key)) query.set(key, value(key));
        for (const [key, v] of Object.entries(changes)) {
            if (v === null || v === "") query.delete(key);
            else query.set(key, String(v));
        }
        return `/shop${query.size ? `?${query}` : ""}`;
    };
    const active = filterKeys.filter(
        (key) =>
            value(key) &&
            !(key === "sort" && value(key) === "newest") &&
            !(key === "availability" && value(key) === "all"),
    );
    const category = categories.find((c) => c.slug === value("category"));
    const chipLabel = (key: (typeof filterKeys)[number]) =>
        ({
            search: `بحث: ${value(key)}`,
            category: category?.nameAr || category?.nameFr || value(key),
            minPrice: `من ${value(key)} MAD`,
            maxPrice: `حتى ${value(key)} MAD`,
            availability: "المتوفر فقط",
            sort: sortLabels[value(key)] || value(key),
        })[key];
    return (
        <section className="page-shell shop-page refined-shop">
            <nav className="shop-breadcrumb" aria-label="مسار التصفح">
                <Link href="/">الرئيسية</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">المتجر</span>
            </nav>
            <div className="shop-intro">
                <div>
                    <p className="eyebrow">THE IMAD EDIT</p>
                    <h1>{category?.nameAr || "اكتشفوا ما يشبهكم."}</h1>
                    <p>قطع تختارونها بطريقتكم. تصفحوا، قارنوا التفاصيل واختاروا ما يناسبكم.</p>
                </div>
                <span className="shop-intro-note">
                    <LayoutGrid size={19} aria-hidden="true" /> مجموعتكم، بتفاصيل أوضح
                </span>
            </div>
            <nav className="shop-category-rail" aria-label="تصفح حسب الفئة">
                <Link
                    href={queryLink({ category: null })}
                    aria-current={!value("category") ? "page" : undefined}
                >
                    <LayoutGrid size={18} aria-hidden="true" />
                    كل القطع
                </Link>
                {publishedCategories(categories).map((c) => (
                    <Link
                        key={c.id}
                        href={queryLink({ category: c.slug })}
                        aria-current={value("category") === c.slug ? "page" : undefined}
                    >
                        {categoryThumbnail(c.slug) && (
                            <Image src={categoryThumbnail(c.slug)} width={30} height={30} alt="" />
                        )}
                        {c.nameAr || c.nameFr}
                        <small>({c.publishedCount})</small>
                    </Link>
                ))}
            </nav>
            <details
                key={JSON.stringify(raw)}
                id="catalog-search"
                className="filter-panel catalog-filter-panel"
                open={value("filters") === "open" || invalid}
            >
                <summary>
                    <SlidersHorizontal size={19} aria-hidden="true" />
                    <span>البحث والفلاتر</span>
                    {active.length > 0 && (
                        <span className="active-filter-count">{active.length}</span>
                    )}
                    <span className="filter-result-count">الفئة، السعر والتوفر</span>
                </summary>
                <form action="/shop" method="get" className="shop-filters catalog-filter-form">
                    <div className="filter-form-heading">
                        <h2>اختاروا التفاصيل المناسبة</h2>
                        <p>يمكنكم الجمع بين أكثر من فلتر، ثم عرض النتائج.</p>
                    </div>
                    <label className="filter-search">
                        البحث عن منتج
                        <span className="filter-search-field">
                            <Search size={18} aria-hidden="true" />
                            <input
                                type="search"
                                name="search"
                                maxLength={120}
                                defaultValue={value("search")}
                                placeholder="اسم المنتج أو كلمة للبحث"
                            />
                        </span>
                    </label>
                    <label>
                        الفئة
                        <select
                            className="store-input"
                            name="category"
                            defaultValue={value("category")}
                        >
                            <option value="">جميع الفئات</option>
                            {publishedCategories(categories).map((c) => (
                                <option key={c.id} value={c.slug}>
                                    {c.nameAr || c.nameFr}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        الترتيب
                        <select
                            className="store-input"
                            name="sort"
                            defaultValue={value("sort") || "newest"}
                        >
                            {Object.entries(sortLabels).map(([v, label]) => (
                                <option key={v} value={v}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <fieldset className="filter-price-range">
                        <legend>ميزانيتكم (MAD)</legend>
                        <div>
                            <label>
                                من
                                <input
                                    className="store-input"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    name="minPrice"
                                    min="0"
                                    max="1000000"
                                    defaultValue={value("minPrice")}
                                    placeholder="0"
                                />
                            </label>
                            <span aria-hidden="true">—</span>
                            <label>
                                إلى
                                <input
                                    className="store-input"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    name="maxPrice"
                                    min="0"
                                    max="1000000"
                                    defaultValue={value("maxPrice")}
                                    placeholder="بدون حد"
                                />
                            </label>
                        </div>
                    </fieldset>
                    <label className="filter-stock-choice">
                        <input
                            type="checkbox"
                            name="availability"
                            value="in-stock"
                            defaultChecked={value("availability") === "in-stock"}
                        />
                        <span>
                            عرض المنتجات المتوفرة فقط
                            <small>القطع التي لديها خيار واحد متوفر على الأقل</small>
                        </span>
                    </label>
                    <div className="filter-form-actions">
                        <button className="btn-primary" type="submit">
                            عرض النتائج <ArrowUpLeft size={18} aria-hidden="true" />
                        </button>
                        <Link href="/shop">مسح الفلاتر</Link>
                    </div>
                </form>
            </details>
            {invalid && (
                <p role="alert" className="shop-filter-error">
                    بعض الفلاتر غير صالحة. تحققوا من نطاق السعر، ثم أعيدوا المحاولة. تظهر المجموعة
                    الكاملة مؤقتاً.
                </p>
            )}
            {active.length > 0 && (
                <nav className="active-filter-chips" aria-label="الفلاتر المطبقة">
                    {active.map((key) => (
                        <Link
                            key={key}
                            href={queryLink({ [key]: null })}
                            aria-label={`إزالة الفلتر: ${chipLabel(key)}`}
                        >
                            <span>{chipLabel(key)}</span>
                            <X size={14} aria-hidden="true" />
                        </Link>
                    ))}
                    <Link className="clear-all-filters" href="/shop">
                        مسح الكل
                    </Link>
                </nav>
            )}
            <div className="catalog-results-heading">
                <div>
                    <h2> {category?.nameAr || "كل القطع"}</h2>
                    <p role="status">
                        {result.total} {result.total === 1 ? "منتج" : "منتجات"}
                        {result.totalPages > 1 &&
                            ` · الصفحة ${result.page} من ${result.totalPages}`}
                    </p>
                </div>
                <Link
                    className={`stock-quick-filter ${value("availability") === "in-stock" ? "is-active" : ""}`}
                    href={queryLink({
                        availability: value("availability") === "in-stock" ? null : "in-stock",
                    })}
                    aria-label={
                        value("availability") === "in-stock"
                            ? "إلغاء فلتر المتوفر فقط"
                            : "المتوفر فقط"
                    }
                >
                    <Check size={15} aria-hidden="true" />
                    المتوفر فقط
                </Link>
            </div>
            {result.data.length ? (
                <div className="catalog-grid">
                    {result.data.map((p) => (
                        <ProductCard product={p} key={p.id} headingLevel={3} />
                    ))}
                </div>
            ) : (
                <div className="shop-empty-state">
                    <Search size={30} aria-hidden="true" />
                    <h3>
                        {active.length
                            ? "لم نجد القطعة بهذه التفاصيل."
                            : "مجموعتنا الجديدة قيد التحضير."}
                    </h3>
                    <p>
                        {active.length
                            ? "حاولوا إزالة فلتر أو توسيع نطاق السعر."
                            : "تواصلوا معنا للاستفسار عن القطع المتوفرة."}
                    </p>
                    <Link className="btn-primary" href={active.length ? "/shop" : "/contact"}>
                        {active.length ? "عرض كل القطع" : "تواصلوا معنا"}
                    </Link>
                </div>
            )}
            {result.totalPages > 1 && (
                <nav aria-label="صفحات المنتجات" className="shop-pagination">
                    {result.page > 1 && (
                        <Link href={queryLink({ page: result.page - 1 })}>الصفحة السابقة</Link>
                    )}
                    <span>
                        {result.page} / {result.totalPages}
                    </span>
                    {result.page < result.totalPages && (
                        <Link href={queryLink({ page: result.page + 1 })}>الصفحة التالية</Link>
                    )}
                </nav>
            )}
        </section>
    );
}
