"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MAX_HERO_PRODUCTS } from "@imad-store/shared";
import { getAdminProducts, type Product } from "@/lib/api";
import { isAvailableHeroProduct } from "@/lib/hero-selection";
import { ProductPhoto } from "@/components/store/ProductPhoto";
import { useAdminLocale } from "./admin-locale";

export function HeroProducts({
    value,
    manual,
    onModeChange,
    onChange,
    selected,
    loading,
    error,
    onRetry,
}: {
    value: string[] | undefined;
    manual: boolean;
    onModeChange: (manual: boolean) => void;
    onChange: (ids: string[] | undefined) => void;
    selected: Product[];
    loading: boolean;
    error: boolean;
    onRetry: () => void;
}) {
    const { t, locale } = useAdminLocale();
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [page, setPage] = useState(1);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);
    const ids = value ?? [];
    const catalogue = useQuery({
        queryKey: ["hero-product-picker", debounced, page],
        queryFn: () => getAdminProducts({ status: "ACTIVE", search: debounced, page, limit: 20 }),
        enabled: manual,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: false,
    });
    const name = (product?: Product) =>
        product
            ? locale === "ar"
                ? product.nameAr || product.nameFr
                : product.nameFr || product.nameAr
            : t("Produit indisponible");
    const move = (index: number, direction: number) => {
        const next = index + direction;
        if (next < 0 || next >= ids.length) return;
        const order = [...ids];
        [order[index], order[next]] = [order[next], order[index]];
        onChange(order);
    };
    return (
        <div className="hero-selection-editor">
            <div
                className="hero-selection-modes"
                role="group"
                aria-label={t("Choix des produits du bandeau")}
            >
                <label>
                    <input
                        type="radio"
                        name="hero-selection"
                        checked={!manual}
                        onChange={() => onModeChange(false)}
                    />
                    {t("Sélection automatique")}
                </label>
                <label>
                    <input
                        type="radio"
                        name="hero-selection"
                        checked={manual}
                        onChange={() => onModeChange(true)}
                    />
                    {t("Choisir les produits")}
                </label>
            </div>
            {!manual ? (
                <p className="admin-muted">
                    {t(
                        "Le bandeau utilise automatiquement quatre produits disponibles au maximum.",
                    )}
                </p>
            ) : (
                <>
                    <p className="admin-muted">
                        {t(
                            "Choisissez jusqu’à six produits. L’ordre ci-dessous sera celui du bandeau, y compris au-delà des huit produits de l’accueil.",
                        )}
                    </p>
                    <p role="status">
                        {ids.length} / {MAX_HERO_PRODUCTS} · {t("produits sélectionnés")}
                    </p>
                    {error && (
                        <div className="admin-alert" role="alert">
                            <p>
                                {t(
                                    "Impossible de charger les produits sélectionnés. Votre choix est conservé.",
                                )}
                            </p>
                            <button type="button" className="admin-button" onClick={onRetry}>
                                {t("Réessayer")}
                            </button>
                        </div>
                    )}
                    <ol
                        className="hero-selected-list"
                        aria-label={t("Ordre des produits du bandeau")}
                    >
                        {ids.map((id, index) => {
                            const product = selected.find((p) => p.id === id);
                            const label = name(product);
                            return (
                                <li key={id}>
                                    <span className="hero-selected-number" aria-hidden="true">
                                        {index + 1}
                                    </span>
                                    <span className="hero-admin-photo">
                                        {product && (
                                            <ProductPhoto
                                                images={product.images}
                                                name=""
                                                thumbnail
                                                sizes="48px"
                                            />
                                        )}
                                    </span>
                                    <div className="hero-selected-name">
                                        <strong dir="auto">
                                            {loading && !product ? t("Chargement…") : label}
                                        </strong>
                                        {!loading &&
                                            !error &&
                                            (!product || !isAvailableHeroProduct(product)) && (
                                                <small>
                                                    {t(
                                                        "Indisponible : ignoré dans le bandeau public, sans remplacer votre choix.",
                                                    )}
                                                </small>
                                            )}
                                    </div>
                                    <div className="hero-order-actions">
                                        <button
                                            type="button"
                                            className="admin-button"
                                            aria-label={`${t("Monter")} · ${label}`}
                                            disabled={index === 0}
                                            onClick={() => move(index, -1)}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-button"
                                            aria-label={`${t("Descendre")} · ${label}`}
                                            disabled={index === ids.length - 1}
                                            onClick={() => move(index, 1)}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-button"
                                            aria-label={`${t("Retirer du bandeau")} · ${label}`}
                                            onClick={() =>
                                                onChange(ids.filter((item) => item !== id))
                                            }
                                        >
                                            ×
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                    {!ids.length && (
                        <p className="admin-muted">
                            {t(
                                "Sans sélection, le bandeau reste statique. Aucun autre produit n’est ajouté automatiquement.",
                            )}
                        </p>
                    )}
                    <label>
                        {t("Rechercher un produit pour le bandeau")}
                        <input
                            type="search"
                            className="admin-field"
                            dir="auto"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                        />
                    </label>
                    {catalogue.isPending ? (
                        <p role="status">{t("Chargement…")}</p>
                    ) : catalogue.isError ? (
                        <div role="alert">
                            <p>{t("Impossible de charger le catalogue.")}</p>
                            <button
                                type="button"
                                className="admin-button"
                                onClick={() => void catalogue.refetch()}
                            >
                                {t("Réessayer")}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div
                                className="hero-product-options"
                                aria-label={t("Produits disponibles pour le bandeau")}
                            >
                                {catalogue.data.data.map((product) => {
                                    const checked = ids.includes(product.id);
                                    const available = isAvailableHeroProduct(product);
                                    return (
                                        <label key={product.id}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={
                                                    !checked &&
                                                    (!available || ids.length >= MAX_HERO_PRODUCTS)
                                                }
                                                onChange={(event) =>
                                                    onChange(
                                                        event.target.checked
                                                            ? [...ids, product.id]
                                                            : ids.filter((id) => id !== product.id),
                                                    )
                                                }
                                            />
                                            <span className="hero-admin-photo">
                                                <ProductPhoto
                                                    images={product.images}
                                                    name=""
                                                    thumbnail
                                                    sizes="48px"
                                                />
                                            </span>
                                            <span dir="auto">
                                                {name(product)}
                                                {!available && (
                                                    <small>
                                                        {t("Photo ou stock disponible requis")}
                                                    </small>
                                                )}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            {!catalogue.data.data.length && (
                                <p role="status">{t("Aucun produit trouvé.")}</p>
                            )}
                            <div
                                className="hero-picker-pagination"
                                role="group"
                                aria-label={t("Pages du catalogue du bandeau")}
                            >
                                <button
                                    type="button"
                                    className="admin-button"
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    {t("Précédent")}
                                </button>
                                <span>
                                    {page} / {Math.max(1, catalogue.data.totalPages)}
                                </span>
                                <button
                                    type="button"
                                    className="admin-button"
                                    disabled={page >= catalogue.data.totalPages}
                                    onClick={() => setPage(page + 1)}
                                >
                                    {t("Suivant")}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
