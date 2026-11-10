"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { inventoryStatus, inventoryVariants, type InventoryStatus } from "./product-utils";

const pageSize = 30;
const filters = [
    ["ALL", "Toutes les variantes"],
    ["LOW", "Stock faible"],
    ["OUT", "En rupture"],
] as const;

export default function InventoryTab({
    products, total, stock, onStock, onProduct,
}: {
    products: Product[];
    total: number;
    stock: InventoryStatus;
    onStock: (value: InventoryStatus) => void;
    onProduct: (id: string) => void;
}) {
    const { t, locale } = useAdminLocale();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const variants = useMemo(() => inventoryVariants(products), [products]);
    const query = search.trim().toLocaleLowerCase();
    const matching = variants.filter(({ product, variant }) =>
        (stock === "ALL" || inventoryStatus(variant.stock) === stock) &&
        [product.nameFr, product.nameAr, product.nameEn, variant.sku, variant.size,
            variant.colorNameFr, variant.colorNameAr, variant.colorNameEn]
            .some((value) => value?.toLocaleLowerCase().includes(query)),
    ).sort((a, b) => a.variant.stock - b.variant.stock);
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    const current = Math.min(page, pages);

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
                        onClick={() => { onStock(value); setPage(1); }}>
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
                            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                </label>
            </div>
            <p className="admin-muted" role="status">{t("{count} variante(s) trouvée(s)", { count: matching.length })}</p>
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
            {pages > 1 && (
                <div className="admin-inventory-pages">
                    <button type="button" className="admin-button" disabled={current === 1}
                        onClick={() => setPage(current - 1)}>{t("Page précédente")}</button>
                    <span>{t("Page {page} sur {total}", { page: current, total: pages })}</span>
                    <button type="button" className="admin-button" disabled={current === pages}
                        onClick={() => setPage(current + 1)}>{t("Page suivante")}</button>
                </div>
            )}
        </section>
    );
}
