import Link from "next/link";
import type { Metadata } from "next";
import { publicProducts, publicCategories, requestSiteOrigin } from "@/lib/server-api";
import { collectionShareMetadata, storefrontShareMetadata } from "@/lib/share-metadata";
import { ArrowUpLeft, Check, ChevronDown, LayoutGrid, Search, X } from "lucide-react";
import { CatalogFilters } from "@/components/store/CatalogFilters";
import { ProductCard } from "@/components/store/ProductCard";
import { CatalogSectionLinks } from "@/components/store/CatalogSectionLinks";
import { ProductPhoto } from "@/components/store/ProductPhoto";
import { categoryImageSources } from "@/components/store/category-visuals";
import { availableCatalogSections, publishedCategories } from "@/lib/catalog-navigation";
import { orderedSizes, sizeKey, sizeLabel, distinctColorLabels } from "@/lib/product-presentation";
import { catalogSectionKeys, catalogSections } from "@imad-store/shared";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
    const raw = await searchParams;
    const origin = await requestSiteOrigin();
    if (typeof raw.category === "string") {
        const category = publishedCategories(await publicCategories()).find((entry) => entry.slug === raw.category);
        if (category) return collectionShareMetadata(category, origin);
    }
    return storefrontShareMetadata("shop", origin);
}
const filterKeys = ["search", "category", "section", "sort", "minPrice", "maxPrice", "availability", "size", "color"] as const;
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
    const params: Record<string, string | number> = { limit: 12, includeFilters: "1" };
    for (const key of filterKeys) if (value(key)) params[key] = value(key);
    const page = Number(value("page") || 1);
    params.page = Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
    const categories = await publicCategories();
    const sectionKey = catalogSectionKeys.find((key) => key === value("section"));
    const section = sectionKey ? catalogSections[sectionKey] : undefined;
    const sectionCategories = publishedCategories(categories).filter(
        (category) => !section || section.categorySlugs.includes(category.slug),
    );
    let result: Awaited<ReturnType<typeof publicProducts>> | null = null;
    let invalid = Array.isArray(raw.size) || Array.isArray(raw.section) || Array.isArray(raw.color);
    try {
        if (!invalid) result = await publicProducts(params);
    } catch (error) {
        // Keep rejected filters editable without presenting unrelated products as matches.
        // An upstream outage must still reach the error boundary.
        if (error instanceof Error && error.message.endsWith("(400)")) {
            invalid = true;
        } else throw error;
    }
    const missingPage = Boolean(result && result.total > 0 && result.page > result.totalPages);
    const queryLink = (changes: Record<string, string | number | null> = {}) => {
        const query = new URLSearchParams();
        for (const key of filterKeys) if (value(key)) query.set(key, value(key));
        for (const [key, v] of Object.entries(changes)) {
            if (v === null || v === "") query.delete(key);
            else query.set(key, String(v));
        }
        return `/shop${query.size ? `?${query}` : ""}`;
    };
    const category = categories.find((c) => c.slug === value("category"));
    const categoryTitle = category?.nameAr || category?.nameFr;
    const collectionImages = category ? categoryImageSources(category, []) : [];
    const scope = new URLSearchParams(category ? { category: category.slug } : {});
    if (category && sectionKey) scope.set("section", sectionKey);
    const clearFiltersHref = scope.size ? `/shop?${scope}` : "/shop";
    const active = filterKeys.filter(
        (key) =>
            value(key) &&
            !(category && (key === "category" || key === "section")) &&
            !(key === "sort" && value(key) === "newest") &&
            !(key === "availability" && value(key) === "all"),
    );
    const sort = value("sort") || "newest";
    const selectedColor = value("color");
    const colors = distinctColorLabels(result?.filterOptions?.colors ?? []);
    const colorLabel = colors.find((color) => color.value === selectedColor)?.label;
    const resultAnchor = category ? "#catalog-results" : "";
    const chipLabel = (key: (typeof filterKeys)[number]) =>
        ({
            search: `بحث: ${value(key)}`,
            category: category?.nameAr || category?.nameFr || value(key),
            section: section?.nameAr || value(key),
            minPrice: `من ${value(key)} MAD`,
            maxPrice: `حتى ${value(key)} MAD`,
            availability: "المتوفر فقط",
            sort: sortLabels[value(key)] || value(key),
            size: `المقاس: ${sizeLabel(value(key))}`,
            color: `اللون: ${colorLabel || selectedColor}`,
        })[key];
    const suggestedSizes = result?.filterOptions?.sizes;
    const sizes = suggestedSizes ? orderedSizes(suggestedSizes.map(size => ({ size }))) : [];
    return (
        <section className="page-shell shop-page refined-shop">
            <nav className="shop-breadcrumb" aria-label="مسار التصفح">
                <Link href="/">الرئيسية</Link>
                <span aria-hidden="true">/</span>
                {categoryTitle ? (
                    <>
                        <Link href="/shop">المتجر</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">{categoryTitle}</span>
                    </>
                ) : (
                    <span aria-current="page">المتجر</span>
                )}
            </nav>
            {categoryTitle ? (
                <header className="shop-collection-heading">
                    <div>
                        <p className="shop-collection-kicker">مجموعة IMAD</p>
                        <h1>{categoryTitle}</h1>
                        <p>تصفحوا القطع واختاروا ما يناسبكم.</p>
                    </div>
                    {collectionImages.length > 0 && (
                        <span className="shop-collection-photo" aria-hidden="true">
                            <ProductPhoto
                                images={collectionImages}
                                name=""
                                sizes="(max-width: 767px) 88px, 148px"
                                eager
                                thumbnail
                            />
                        </span>
                    )}
                </header>
            ) : (
                <div className="shop-intro">
                    <div>
                        <p className="eyebrow">THE IMAD EDIT</p>
                        <h1>{section?.nameAr || "اكتشفوا ما يشبهكم."}</h1>
                        <p>قطع تختارونها بطريقتكم. تصفحوا، قارنوا التفاصيل واختاروا ما يناسبكم.</p>
                    </div>
                    <span className="shop-intro-note">
                        <LayoutGrid size={19} aria-hidden="true" /> مجموعتكم، بتفاصيل أوضح
                    </span>
                </div>
            )}
            <div className="shop-navigation-rails">
                <CatalogSectionLinks
                    sections={availableCatalogSections(categories)}
                    active={sectionKey}
                    allHref={queryLink({ section: null, category: null })}
                    hrefFor={(key) => queryLink({ section: key, category: null })}
                />
                <nav className="shop-category-rail" aria-label="تصفح حسب الفئة">
                    <Link
                        href={queryLink({ category: null })}
                        aria-current={!value("category") ? "page" : undefined}
                    >
                        <LayoutGrid size={18} aria-hidden="true" />
                        كل القطع
                    </Link>
                    {sectionCategories.map((c) => {
                        const images = categoryImageSources(c, []);
                        return (
                            <Link
                                key={c.id}
                                href={queryLink({ category: c.slug })}
                                aria-current={value("category") === c.slug ? "page" : undefined}
                            >
                                {images.length > 0 && (
                                    <span className="category-rail-photo" aria-hidden="true">
                                        <ProductPhoto images={images} name="" sizes="30px" thumbnail />
                                    </span>
                                )}
                                {c.nameAr || c.nameFr}
                                <small>({c.publishedCount})</small>
                            </Link>
                        );
                    })}
                </nav>
            </div>
            <div id="catalog-results" className="catalog-tools-row">
            <CatalogFilters key={JSON.stringify(raw)} count={active.length}
                initialOpen={value("filters") === "open" || invalid}>
                <form
                    action={`/shop${resultAnchor}`}
                    method="get"
                    className="shop-filters catalog-filter-form"
                    aria-describedby={invalid ? "catalog-filter-error" : undefined}
                >
                    {invalid && (
                        <p id="catalog-filter-error" role="alert" className="shop-filter-error">
                            تعذر تطبيق هذه الفلاتر. صححوا الفلاتر، بما فيها نطاق السعر، ثم اعرضوا النتائج مجدداً. لم يتم عرض منتجات خارج شروط البحث.
                        </p>
                    )}
                    {sectionKey && <input type="hidden" name="section" value={sectionKey} />}
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
                    {category ? (
                        <input type="hidden" name="category" value={category.slug} />
                    ) : (
                        <label>
                            الفئة
                            <select
                                className="store-input"
                                name="category"
                                defaultValue={value("category")}
                            >
                                <option value="">جميع الفئات</option>
                                {sectionCategories.map((c) => (
                                    <option key={c.id} value={c.slug}>
                                        {c.nameAr || c.nameFr}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label>
                        المقاس
                        {suggestedSizes ? (
                            <select className="store-input" name="size" aria-label="المقاس" aria-describedby="catalog-size-help" defaultValue={sizes.find(size => sizeKey(size) === sizeKey(value("size"))) ?? value("size")}>
                                <option value="">جميع المقاسات</option>
                                {value("size") && !sizes.some(size => sizeKey(size) === sizeKey(value("size"))) && <option value={value("size")}>{sizeLabel(value("size"))} — المقاس المحدد</option>}
                                {sizes.map(size => <option key={size} value={size}>{sizeLabel(size)}</option>)}
                            </select>
                        ) : (
                            <input className="store-input" name="size" aria-label="المقاس" aria-describedby="catalog-size-help" maxLength={40}
                                defaultValue={value("size")} placeholder="مثلاً 40 أو M" />
                        )}
                        <small id="catalog-size-help" className="filter-size-help">عند اختيار مقاس ولون، تظهر القطع التي يتوفر فيها الخياران معاً.</small>
                    </label>
                    {(colors.length > 0 || selectedColor) && (
                        <label>
                            اللون
                            <select className="store-input" name="color" defaultValue={selectedColor}>
                                <option value="">جميع الألوان</option>
                                {selectedColor && !colorLabel && <option value={selectedColor}>{selectedColor}</option>}
                                {colors.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                    )}
                    <label>
                        الترتيب
                        <select
                            className="store-input"
                            name="sort"
                            defaultValue={sort}
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
                        <Link href={clearFiltersHref}>مسح الفلاتر</Link>
                    </div>
                </form>
            </CatalogFilters>
            {result && (
                    <div className="catalog-results-heading">
                        <div>
                            <h2>{category ? "المنتجات" : section?.nameAr || "كل القطع"}</h2>
                            <p role="status">
                                {result.total} {result.total === 1 ? "منتج" : "منتجات"}
                                {!missingPage &&
                                    result.totalPages > 1 &&
                                    ` · الصفحة ${result.page} من ${result.totalPages}`}
                            </p>
                        </div>
                        <div className="catalog-result-tools">
                            {category && (
                                <details className="collection-sort" key={JSON.stringify(raw)}>
                                    <summary>
                                        الترتيب: {sortLabels[sort] || sortLabels.newest}
                                        <ChevronDown size={15} aria-hidden="true" />
                                    </summary>
                                    <div role="group" aria-label="ترتيب المنتجات">
                                        {Object.entries(sortLabels).map(([key, label]) => (
                                            <Link
                                                key={key}
                                                href={queryLink({ sort: key === "newest" ? null : key }) + resultAnchor}
                                                aria-current={sort === key ? "true" : undefined}
                                            >
                                                {label}
                                            </Link>
                                        ))}
                                    </div>
                                </details>
                            )}
                            <Link
                                className={`stock-quick-filter ${value("availability") === "in-stock" ? "is-active" : ""}`}
                                href={queryLink({
                                    availability:
                                        value("availability") === "in-stock" ? null : "in-stock",
                                }) + resultAnchor}
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
                    </div>
            )}
            </div>
            {result && active.length > 0 && (
                <nav className="active-filter-chips" aria-label="الفلاتر المطبقة">
                    {active.map((key) => (
                        <Link
                            key={key}
                            href={queryLink({ [key]: null }) + resultAnchor}
                            aria-label={`إزالة الفلتر: ${chipLabel(key)}`}
                        >
                            {key === "color" && /^#[0-9a-f]{6}$/i.test(selectedColor) && (
                                <span className="filter-color-swatch" style={{ backgroundColor: selectedColor }} aria-hidden="true" />
                            )}
                            <span>{chipLabel(key)}</span>
                            <X size={14} aria-hidden="true" />
                        </Link>
                    ))}
                    <Link className="clear-all-filters" href={clearFiltersHref}>
                        مسح الكل
                    </Link>
                </nav>
            )}

            {result && (
                <>
                    {result.data.length ? (
                        <div className="catalog-grid">
                            {result.data.map((p, index) => (
                                <ProductCard
                                    product={p}
                                    key={p.id}
                                    headingLevel={3}
                                    eagerImage={index === 0}
                                    preferredSize={value("size") || undefined}
                                    preferredColor={selectedColor || undefined}
                                    returnTo={queryLink({ page: result.page > 1 ? result.page : null })}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="shop-empty-state">
                            <Search size={30} aria-hidden="true" />
                            <h3>
                                {missingPage
                                    ? "هذه الصفحة غير متاحة."
                                    : active.length
                                      ? "لم نجد القطعة بهذه التفاصيل."
                                      : "مجموعتنا الجديدة قيد التحضير."}
                            </h3>
                            <p>
                                {missingPage
                                    ? "ما زالت هناك منتجات تطابق بحثكم. عودوا إلى أول صفحة مع الاحتفاظ بالفلاتر."
                                    : active.length
                                      ? "حاولوا إزالة فلتر أو توسيع نطاق السعر."
                                      : "تواصلوا معنا للاستفسار عن القطع المتوفرة."}
                            </p>
                            <Link
                                className="btn-primary"
                                href={
                                    missingPage ? queryLink() : active.length ? clearFiltersHref : "/contact"
                                }
                            >
                                {missingPage
                                    ? "العودة إلى أول صفحة"
                                    : active.length
                                      ? category ? "مسح الفلاتر" : "عرض كل القطع"
                                      : "تواصلوا معنا"}
                            </Link>
                        </div>
                    )}
                    {!missingPage && result.totalPages > 1 && (
                        <nav aria-label="صفحات المنتجات" className="shop-pagination">
                            {result.page > 1 && (
                                <Link href={queryLink({ page: result.page - 1 })}>
                                    الصفحة السابقة
                                </Link>
                            )}
                            <span>
                                {result.page} / {result.totalPages}
                            </span>
                            {result.page < result.totalPages && (
                                <Link href={queryLink({ page: result.page + 1 })}>
                                    الصفحة التالية
                                </Link>
                            )}
                        </nav>
                    )}
                </>
            )}
        </section>
    );
}
