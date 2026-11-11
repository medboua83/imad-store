"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { Product } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { inventoryStatus, inventoryVariants } from "./product-utils";
import { initialInventoryListFilters, type InventoryListFilters } from "./inventory-list-context";
import { matchesCatalogueSearch } from "./catalogue-search";

const pageSize = 30;
const filters = [
    ["ALL", "Toutes les variantes"],
    ["LOW", "Stock faible"],
    ["OUT", "En rupture"],
] as const;

export default function InventoryTab({
    products, total, filters: selection, onFilters, onProduct,
}: {
    products: Product[];
    total: number;
    filters: InventoryListFilters;
    onFilters: (value: InventoryListFilters) => void;
    onProduct: (id: string) => void;
}) {
    const { t, locale } = useAdminLocale();
    const { search, page, stock } = selection;
    const result = useRef<HTMLParagraphElement>(null);
    const pageNavigation = useRef(false);
    const variants = useMemo(() => inventoryVariants(products), [products]);
    const matching = variants.filter(({ product, variant }) =>
        (stock === "ALL" || inventoryStatus(variant.stock) === stock) &&
        matchesCatalogueSearch([product.nameFr, product.nameAr, product.nameEn,
            product.category.nameFr, product.category.nameAr, product.category.nameEn,
            variant.sku, variant.size, variant.color, variant.colorNameFr, variant.colorNameAr,
            variant.colorNameEn], search),
    ).sort((a, b) => a.variant.stock - b.variant.stock);
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    const current = Math.min(page, pages);
    useEffect(() => {
        if (!pageNavigation.current) return;
        pageNavigation.current = false;
        result.current?.focus({ preventScroll: true });
        result.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }, [current]);
    function changePage(next: number) {
        pageNavigation.current = true;
        onFilters({ ...selection, page: next });
    }
    function pagination(label: string) {
        return pages > 1 && <nav className="admin-inventory-pages" aria-label={t(label)}>
            <button type="button" className="admin-button" disabled={current === 1}
                onClick={() => changePage(current - 1)}>{t("Page précédente")}</button>
            <span>{t("Page {page} sur {total}", { page: current, total: pages })}</span>
            <button type="button" className="admin-button" disabled={current === pages}
                onClick={() => changePage(current + 1)}>{t("Page suivante")}</button>
        </nav>;
    }

    return (
        <section className="admin-panel">
            <div className="admin-panel-heading">
                <div>
                    <h2>{t("Inventaire par variante")}</h2>
                    <p>{t("Variantes des produits en vente · {count} fiches chargées sur {total}.", {
                        count: products.length, total,
                    })}</p>
                </div>
            </div>
            <div className="order-quick-filters" role="group" aria-label={t("État du stock")}>
                {filters.map(([value, label]) => (
                    <button type="button" className="order-filter" key={value} aria-pressed={stock === value}
                        onClick={() => onFilters({ ...selection, stock: value, page: 1 })}>
                        {t(label)}
                        <span>{value === "ALL" ? variants.length : variants.filter(
                            ({ variant }) => inventoryStatus(variant.stock) === value,
                        ).length}</span>
                    </button>
                ))}
            </div>
            <div className="admin-toolbar">
                <label className="admin-search">
                    <span>{t("Rechercher dans le stock")}</span>
                    <div>
                        <Search size={17} aria-hidden="true" />
                        <input type="search" dir="auto" placeholder={t("Produit, SKU, taille ou couleur")}
                            value={search} onChange={(e) => onFilters({ ...selection, search: e.target.value, page: 1 })} />
                    </div>
                </label>
                <button type="button" className="admin-text-button"
                    disabled={!search && stock === "ALL" && current === 1}
                    onClick={() => onFilters(initialInventoryListFilters)}>
                    {t("Effacer la recherche et les filtres")}
                </button>
            </div>
            <p ref={result} className="admin-muted admin-inventory-results" role="status" tabIndex={-1}>
                {t("{count} variante(s) trouvée(s)", { count: matching.length })}
                {matching.length > 0 && <> · {t("Affichage {from}–{to}", {
                    from: (current - 1) * pageSize + 1, to: Math.min(current * pageSize, matching.length),
                })}</>}
            </p>
            {pagination("Navigation du stock, début")}
            {matching.length > 0 ? (
                <ul className="admin-inventory-list">
                    {matching.slice((current - 1) * pageSize, current * pageSize).map(({ product, variant }) => {
                        const name = locale === "ar" ? product.nameAr || product.nameFr : product.nameFr;
                        const color = locale === "ar" ? variant.colorNameAr || variant.colorNameFr : variant.colorNameFr;
                        return (
                            <li key={variant.id}>
                                <div>
                                    <strong dir="auto">{name}</strong>
                                    <p className="admin-muted">
                                        <bdi>{variant.sku}</bdi>{color && <> · <bdi>{color}</bdi></>}
                                        {variant.size && <> · <bdi>{variant.size}</bdi></>}
                                    </p>
                                </div>
                                <span className="admin-stock-value" data-stock={inventoryStatus(variant.stock)}>
                                    {t("{count} disponible(s)", { count: variant.stock })}
                                </span>
                                <button type="button" className="admin-button" onClick={() => onProduct(product.id)}
                                    aria-label={t("Voir le produit {name}", { name })}>
                                    {t("Voir la fiche")}
                                    <ArrowUpRight size={15} aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : <p className="admin-empty">{t("Aucune variante dans cette sélection.")}</p>}
            {pagination("Navigation du stock, fin")}
        </section>
    );
}
