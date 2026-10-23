"use client";
import { useEffect, useState } from "react";
import { getAdminProducts, type Product, type RecommendationSettings } from "@/lib/api";
import { AdminProductPhoto } from "./admin-product-photo";

export function ProductRecommendationEditor({
    value,
    onChange,
    currentId,
    products,
    disabled,
}: {
    value: RecommendationSettings;
    onChange: (next: RecommendationSettings) => void;
    currentId: string | null;
    products: Product[];
    disabled: boolean;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState(products);
    const [known, setKnown] = useState<Product[]>(products);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const selectedKey = [...new Set([...value.upsellProductIds, ...value.crossSellProductIds])]
        .sort()
        .join(",");
    useEffect(() => {
        if (!selectedKey) return;
        let active = true;
        getAdminProducts({ ids: selectedKey, limit: 8 })
            .then((response) => {
                if (active)
                    setKnown((old) => [
                        ...new Map([...old, ...response.data].map((p) => [p.id, p])).values(),
                    ]);
            })
            .catch(() => {
                if (active)
                    setError(
                        "Certains noms n’ont pas pu être chargés. Vos sélections sont conservées.",
                    );
            });
        return () => {
            active = false;
        };
    }, [selectedKey]);
    useEffect(() => {
        let active = true;
        const timer = setTimeout(() => {
            getAdminProducts({ search: search.trim(), status: "ACTIVE", limit: 20 })
                .then((response) => {
                    if (!active) return;
                    setResults(response.data);
                    setKnown((old) => [
                        ...new Map([...old, ...response.data].map((p) => [p.id, p])).values(),
                    ]);
                    setError("");
                })
                .catch(() => {
                    if (active)
                        setError(
                            "Recherche indisponible. Vos sélections sont conservées ; réessayez avec un autre terme.",
                        );
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        }, 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [search]);
    const eligible = results.filter(
        (p) =>
            p.id !== currentId &&
            p.status === "ACTIVE" &&
            p.images.length &&
            !p.slug.startsWith("test-19a-") &&
            p.slug !== "demo-bag-sample",
    );
    const groups = [
        {
            key: "upsellProductIds" as const,
            title: "Alternatives / montée en gamme",
            hint: "Sur la fiche : un autre modèle ou une option supérieure à comparer.",
        },
        {
            key: "crossSellProductIds" as const,
            title: "Produits complémentaires",
            hint: "Sur la fiche et dans le panier : des articles qui complètent ce produit.",
        },
    ];
    return (
        <fieldset
            id="product-recommendations"
            className="product-recommendation-editor"
            disabled={disabled}
        >
            <legend>5. Upsell et cross-sell</legend>
            <label className="recommendation-enable">
                <input
                    type="checkbox"
                    checked={value.enabled}
                    onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
                />
                Activer les recommandations de ce produit
            </label>
            <p className="admin-muted">
                Sélectionnez jusqu’à 4 produits par liste, dans l’ordre souhaité. Les produits
                indisponibles sont masqués aux clients. Le panier propose au maximum 2 compléments,
                sans ajout automatique.
            </p>
            <label>
                Rechercher un produit à recommander
                <input
                    type="search"
                    value={search}
                    onChange={(e) => {
                        setLoading(true);
                        setSearch(e.target.value);
                    }}
                    placeholder="Nom français, arabe ou anglais"
                />
            </label>
            <p className="admin-muted" role="status">
                {loading
                    ? "Recherche…"
                    : `${eligible.length} résultat(s) affiché(s). Précisez le nom pour trouver d’autres produits.`}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="recommendation-editor-groups">
                {groups.map((group) => (
                    <fieldset key={group.key}>
                        <legend>{group.title}</legend>
                        <p className="admin-muted">{group.hint}</p>
                        <ol className="recommendation-selected">
                            {value[group.key].map((id, index) => {
                                const product = known.find((p) => p.id === id);
                                return (
                                    <li key={id}>
                                        <span>
                                            {product?.nameFr ||
                                                "Produit enregistré — nom indisponible"}
                                            {product?.status !== "ACTIVE" && product
                                                ? " · masqué aux clients"
                                                : ""}
                                        </span>
                                        <button
                                            className="admin-text-button"
                                            type="button"
                                            disabled={!index}
                                            aria-label={`Monter ${product?.nameFr || "le produit"} dans ${group.title}`}
                                            onClick={() => {
                                                const next = [...value[group.key]];
                                                [next[index - 1], next[index]] = [
                                                    next[index],
                                                    next[index - 1],
                                                ];
                                                onChange({ ...value, [group.key]: next });
                                            }}
                                        >
                                            Monter
                                        </button>
                                        <button
                                            className="admin-text-button"
                                            type="button"
                                            aria-label={`Retirer ${product?.nameFr || "le produit"} de ${group.title}`}
                                            onClick={() =>
                                                onChange({
                                                    ...value,
                                                    [group.key]: value[group.key].filter(
                                                        (v) => v !== id,
                                                    ),
                                                })
                                            }
                                        >
                                            Retirer
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                        <div className="recommendation-picker">
                            {eligible.map((p) => (
                                <label key={p.id}>
                                    <input
                                        type="checkbox"
                                        aria-label={`${p.nameFr} — ${group.title}`}
                                        checked={value[group.key].includes(p.id)}
                                        disabled={
                                            !value[group.key].includes(p.id) &&
                                            value[group.key].length >= 4
                                        }
                                        onChange={(e) =>
                                            onChange({
                                                ...value,
                                                [group.key]: e.target.checked
                                                    ? [...value[group.key], p.id]
                                                    : value[group.key].filter((id) => id !== p.id),
                                            })
                                        }
                                    />
                                    <AdminProductPhoto
                                        images={p.images}
                                        name={p.nameFr}
                                        width={40}
                                        height={48}
                                    />
                                    <span>
                                        {p.nameFr}
                                        <small>
                                            {p.price.toFixed(2)} MAD
                                            {!p.variants.some((v) => v.stock > 0)
                                                ? " · rupture de stock"
                                                : ""}
                                        </small>
                                    </span>
                                </label>
                            ))}
                            {!loading && !eligible.length && (
                                <p className="admin-muted">
                                    Aucun autre produit publié trouvé. Ajoutez ou publiez un autre
                                    article pour le recommander.
                                </p>
                            )}
                        </div>
                    </fieldset>
                ))}
            </div>
            {!value.enabled && (
                <p className="admin-muted">
                    Désactivées : les sélections sont conservées et aucun encadré ne s’affiche aux
                    clients.
                </p>
            )}
        </fieldset>
    );
}
