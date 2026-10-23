"use client";
import { useEffect, useRef, useState } from "react";
import { isAmbiguousSize } from "@imad-store/shared";
import { AdminProductPhoto } from "./admin-product-photo";
import { Plus, Search, Package, RefreshCw, Copy, Trash2 } from "lucide-react";
import { type Product, type Category } from "@/lib/api";
import { ProductPhotos } from "./product-photos";
import {
    type DraftVariant,
    productSlug,
    variantPayload,
    sizeVariants,
    stockMatches,
    stockSummary,
} from "./product-utils";
import { money } from "./admin-utils";
const blank = {
    slug: "",
    nameFr: "",
    nameAr: "",
    nameEn: "",
    descriptionFr: "",
    descriptionAr: "",
    descriptionEn: "",
    price: "",
    compareAtPrice: "",
    promotionEnabled: false,
    freeShipping: false,
    categoryId: "",
    status: "DRAFT",
};
const freshVariant = (): DraftVariant => ({
    key: crypto.randomUUID(),
    color: "#000000",
    colorNameFr: "Noir",
    colorNameAr: "أسود",
    colorNameEn: "Black",
    size: "",
    stock: "0",
    sku: "",
});
type Props = {
    products: Product[];
    total: number;
    categories: Category[];
    onRefresh: () => Promise<Product[]>;
    onCreate: (data: Record<string, unknown>) => Promise<boolean>;
    onUpdate: (id: string, data: Record<string, unknown>) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
};
export function ProductsTab({
    products,
    total,
    categories,
    onCreate,
    onUpdate,
    onDelete,
    onRefresh,
}: Props) {
    const [search, setSearch] = useState(""),
        [publication, setPublication] = useState("ALL"),
        [stock, setStock] = useState("ALL"),
        [sort, setSort] = useState("recent");
    const [open, setOpen] = useState(false),
        [id, setId] = useState<string | null>(null),
        [form, setForm] = useState(blank),
        [variants, setVariants] = useState<DraftVariant[]>([]),
        [images, setImages] = useState<string[]>([]),
        [baseline, setBaseline] = useState("");
    const [busy, setBusy] = useState(false),
        [uploading, setUploading] = useState(false),
        [error, setError] = useState(""),
        [success, setSuccess] = useState(""),
        [uncertain, setUncertain] = useState(false),
        [sizes, setSizes] = useState(""),
        [session, setSession] = useState(0);
    const title = useRef<HTMLHeadingElement>(null),
        listTitle = useRef<HTMLHeadingElement>(null),
        lock = useRef(false);
    const disabled = busy || uploading,
        dirty = open && JSON.stringify({ form, variants, images }) !== baseline;
    const summary = stockSummary(products);
    const visible = products
        .filter(
            (p) =>
                (publication === "ALL" || p.status === publication) &&
                stockMatches(p, stock) &&
                [p.nameFr, p.nameAr, p.nameEn, p.slug, ...p.variants.map((v) => v.sku)].some((v) =>
                    v.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
                ),
        )
        .slice()
        .sort((a, b) =>
            sort === "name"
                ? a.nameFr.localeCompare(b.nameFr, "fr")
                : sort === "stock"
                  ? a.variants.reduce((n, v) => n + v.stock, 0) -
                    b.variants.reduce((n, v) => n + v.stock, 0)
                  : 0,
        );
    useEffect(() => {
        if (!dirty) return;
        const prevent = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", prevent);
        return () => window.removeEventListener("beforeunload", prevent);
    }, [dirty]);
    function discard() {
        return !dirty || confirm("Abandonner les modifications non enregistrées de cette fiche ?");
    }
    function edit(p?: Product, force = false) {
        if (disabled || (!force && (lock.current || !discard()))) return;
        const next = p
            ? {
                  slug: p.slug,
                  nameFr: p.nameFr,
                  nameAr: p.nameAr,
                  nameEn: p.nameEn,
                  descriptionFr: p.descriptionFr,
                  descriptionAr: p.descriptionAr,
                  descriptionEn: p.descriptionEn,
                  price: String(p.price),
                  compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "",
                  promotionEnabled: Boolean(p.compareAtPrice && p.compareAtPrice > p.price),
                  freeShipping: Boolean(p.freeShipping),
                  categoryId: p.category.id,
                  status: p.status,
              }
            : { ...blank };
        const nextVariants = p
            ? p.variants.map((v) => ({
                  ...v,
                  key: v.id,
                  size: v.size || "",
                  stock: String(v.stock),
                  expectedStock: v.stock,
              }))
            : [freshVariant()];
        const nextImages = [...(p?.images || [])];
        setSession((n) => n + 1);
        setId(p?.id || null);
        setForm(next);
        setVariants(nextVariants);
        setImages(nextImages);
        setBaseline(JSON.stringify({ form: next, variants: nextVariants, images: nextImages }));
        setOpen(true);
        setError("");
        setSuccess("");
        setUncertain(false);
        setSizes("");
        requestAnimationFrame(() => {
            title.current?.scrollIntoView({ block: "start", behavior: "smooth" });
            title.current?.focus({ preventScroll: true });
        });
    }
    const set = (key: keyof typeof blank, value: string) =>
        setForm((previous) => ({ ...previous, [key]: value }));
    const variant = (key: string, field: keyof DraftVariant, value: string) =>
        setVariants((previous) =>
            previous.map((v) => (v.key === key ? { ...v, [field]: value } : v)),
        );
    function failure(e: unknown) {
        const r = e as {
            message?: string;
            response?: { data?: { error?: string; details?: { path: string; message: string }[] } };
        };
        return (
            r.response?.data?.details?.map((d) => `${d.path} : ${d.message}`).join(" · ") ||
            r.response?.data?.error ||
            r.message ||
            "Enregistrement impossible."
        );
    }
    async function refresh(reload = false) {
        if (lock.current || disabled) return;
        if (reload && !discard()) return;
        lock.current = true;
        setBusy(true);
        setError("");
        try {
            const next = await onRefresh();
            if (reload) {
                const p = next.find((p) => (id ? p.id === id : p.slug === form.slug));
                if (p) {
                    setBusy(false);
                    edit(p, true);
                } else if (uncertain) {
                    setError(
                        "Produit absent de la sélection chargée. Vérifiez le catalogue avant de réessayer; aucune nouvelle création automatique.",
                    );
                } else setError("Cette fiche ne figure plus dans la sélection chargée.");
            } else setSuccess("Catalogue actualisé. Une fiche en cours d’édition reste inchangée.");
        } catch {
            setError("Actualisation impossible. Vos saisies restent conservées.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (lock.current || disabled || uncertain) return;
        let data: Record<string, unknown>;
        try {
            const payload = variantPayload(variants);
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug))
                throw new Error(
                    "L’adresse utilise uniquement des lettres minuscules sans accents, des chiffres et des tirets.",
                );
            if (
                form.promotionEnabled &&
                (!form.compareAtPrice || Number(form.compareAtPrice) <= Number(form.price))
            )
                throw new Error(
                    "L’ancien prix doit être supérieur au prix actuel, ou laissé vide.",
                );
            if (form.status === "ACTIVE" && (!images.length || !payload.some((v) => v.stock > 0)))
                throw new Error(
                    "Pour mettre en vente : ajoutez une photo et une variante en stock, ou choisissez Brouillon.",
                );
            data = {
                ...form,
                price: Number(form.price),
                compareAtPrice:
                    form.promotionEnabled && form.compareAtPrice
                        ? Number(form.compareAtPrice)
                        : null,
                images,
                variants: payload,
            };
        } catch (e) {
            setError(failure(e));
            return;
        }
        lock.current = true;
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const refreshed = id ? await onUpdate(id, data) : await onCreate(data);
            setOpen(false);
            setSuccess(
                refreshed
                    ? "Produit enregistré. Le catalogue est à jour."
                    : "Produit enregistré. Le catalogue n’a pas pu être actualisé : utilisez Actualiser, sans recréer la fiche.",
            );
            requestAnimationFrame(() => listTitle.current?.focus());
        } catch (e) {
            const response = (e as { response?: { status: number } }).response;
            if (!response) {
                setUncertain(true);
                setError(
                    "Résultat non confirmé. Vérifiez le catalogue avec « Recharger cette fiche » avant toute nouvelle tentative.",
                );
            } else setError(failure(e));
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    const inputClass = "admin-field";
    return (
        <div className="admin-products space-y-5">
            <div className="admin-panel-heading">
                <div>
                    <h2 ref={listTitle} tabIndex={-1}>
                        Produits et stocks
                    </h2>
                    <p>
                        {products.length} fiches chargées sur {total}. Recherche, filtres et
                        compteurs sur cette sélection (100 maximum).
                    </p>
                </div>
                <div className="product-heading-actions">
                    <button className="admin-button" disabled={disabled} onClick={() => refresh()}>
                        <RefreshCw size={16} />
                        Actualiser
                    </button>
                    <button
                        className="admin-button primary"
                        disabled={disabled}
                        onClick={() => edit()}
                    >
                        <Plus size={17} />
                        Ajouter un produit
                    </button>
                </div>
            </div>
            <div className="product-stock-summary">
                <div>
                    <span>Produits en vente</span>
                    <strong>{summary.active}</strong>
                </div>
                <div>
                    <span>Unités en vente</span>
                    <strong>{summary.units}</strong>
                </div>
                <div>
                    <span>Variantes à 3 unités ou moins en vente</span>
                    <strong>{summary.low}</strong>
                </div>
            </div>
            {success && (
                <p className="admin-feedback" role="status">
                    {success}
                </p>
            )}
            {error && (
                <p className="admin-alert" role="alert">
                    {error}
                </p>
            )}
            {open && (
                <form
                    onSubmit={save}
                    className="admin-panel admin-product-editor product-editor"
                    aria-busy={disabled}
                >
                    <div className="product-editor-heading">
                        <div>
                            <p className="admin-eyebrow">
                                FICHE PRODUIT · {id ? "MODIFICATION" : "CRÉATION"}
                            </p>
                            <h3 ref={title} tabIndex={-1}>
                                {id ? "Modifier le produit" : "Nouveau produit"}
                            </h3>
                            <p className="admin-muted">
                                Préparez en brouillon, puis mettez en vente lorsque tout est prêt.
                            </p>
                        </div>
                        <span className="admin-tag">
                            {dirty ? "Modifications non enregistrées" : "Fiche chargée"}
                        </span>
                    </div>
                    <fieldset disabled={disabled} className="product-identity">
                        <legend>1. Informations du produit</legend>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label>
                                Nom français
                                <input
                                    className={inputClass}
                                    required
                                    maxLength={200}
                                    value={form.nameFr}
                                    onChange={(e) => set("nameFr", e.target.value)}
                                />
                            </label>
                            <label>
                                Adresse du produit
                                <div className="product-slug-field">
                                    <input
                                        className={inputClass}
                                        required
                                        maxLength={160}
                                        value={form.slug}
                                        aria-label="Adresse du produit"
                                        placeholder="exemple-sac-beige"
                                        onChange={(e) => set("slug", e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="admin-text-button"
                                        onClick={() => set("slug", productSlug(form.nameFr))}
                                    >
                                        Suggérer
                                    </button>
                                </div>
                            </label>
                            {(
                                [
                                    ["nameAr", "Nom arabe"],
                                    ["nameEn", "Nom anglais"],
                                ] as const
                            ).map(([key, label]) => (
                                <label key={key}>
                                    {label}
                                    <input
                                        className={inputClass}
                                        dir={key === "nameAr" ? "rtl" : undefined}
                                        required
                                        maxLength={200}
                                        value={form[key]}
                                        onChange={(e) => set(key, e.target.value)}
                                    />
                                </label>
                            ))}
                            <label>
                                Prix de vente (MAD)
                                <input
                                    className={inputClass}
                                    required
                                    type="number"
                                    min="0.01"
                                    max="1000000"
                                    step="0.01"
                                    value={form.price}
                                    onChange={(e) => set("price", e.target.value)}
                                />
                            </label>
                            <label className="admin-option-check">
                                <input
                                    type="checkbox"
                                    checked={form.promotionEnabled}
                                    onChange={(e) =>
                                        setForm((v) => ({
                                            ...v,
                                            promotionEnabled: e.target.checked,
                                        }))
                                    }
                                />{" "}
                                Produit en promotion
                            </label>
                            <label className="admin-option-check">
                                <input
                                    type="checkbox"
                                    checked={form.freeShipping}
                                    onChange={(e) =>
                                        setForm((v) => ({ ...v, freeShipping: e.target.checked }))
                                    }
                                />{" "}
                                Livraison offerte pour tout panier contenant ce produit
                            </label>
                            <label>
                                Prix initial barré (promotion)
                                <input
                                    className={inputClass}
                                    type="number"
                                    min="0.01"
                                    max="1000000"
                                    step="0.01"
                                    disabled={!form.promotionEnabled}
                                    required={form.promotionEnabled}
                                    value={form.compareAtPrice}
                                    onChange={(e) => set("compareAtPrice", e.target.value)}
                                />
                            </label>
                            <label>
                                Catégorie
                                <select
                                    className={inputClass}
                                    required
                                    value={form.categoryId}
                                    onChange={(e) => set("categoryId", e.target.value)}
                                >
                                    <option value="">Choisir une catégorie</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nameFr}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Publication
                                <select
                                    className={inputClass}
                                    value={form.status}
                                    onChange={(e) => set("status", e.target.value)}
                                >
                                    <option value="DRAFT">Brouillon</option>
                                    <option value="ACTIVE">En vente</option>
                                    <option value="ARCHIVED">Archivé</option>
                                </select>
                            </label>
                        </div>
                        <details className="product-descriptions">
                            <summary>Descriptions · français, arabe et anglais</summary>
                            {(["Fr", "Ar", "En"] as const).map((lang) => (
                                <label key={lang}>
                                    Description {lang}
                                    <textarea
                                        className={inputClass}
                                        maxLength={20000}
                                        dir={lang === "Ar" ? "rtl" : undefined}
                                        value={form[`description${lang}`]}
                                        onChange={(e) => set(`description${lang}`, e.target.value)}
                                    />
                                </label>
                            ))}
                        </details>
                    </fieldset>
                    <ProductPhotos
                        key={session}
                        images={images}
                        onChange={setImages}
                        busy={disabled}
                        onBusy={setUploading}
                    />
                    <fieldset disabled={disabled} className="product-variants">
                        <legend>3. Variantes et stocks</legend>
                        <p className="admin-muted">
                            Chaque variante possède une référence SKU unique. Le stock correspond
                            aux unités disponibles, après les réservations des commandes.
                        </p>
                        <div className="product-size-builder">
                            <label>
                                Créer plusieurs tailles
                                <input
                                    className={inputClass}
                                    value={sizes}
                                    placeholder="S, M, L, XL"
                                    onChange={(e) => setSizes(e.target.value)}
                                />
                            </label>
                            <button
                                className="admin-button"
                                type="button"
                                onClick={() => {
                                    try {
                                        const source =
                                            variants[variants.length - 1] || freshVariant();
                                        const generated = sizeVariants(
                                            source,
                                            sizes,
                                            form.slug,
                                            variants,
                                        );
                                        if (!generated.length)
                                            throw new Error(
                                                "Ces tailles existent déjà pour cette couleur.",
                                            );
                                        setVariants((old) => [
                                            ...old,
                                            ...generated.map((v) => ({
                                                ...v,
                                                key: crypto.randomUUID(),
                                            })),
                                        ]);
                                        setSizes("");
                                        setError("");
                                    } catch (e) {
                                        setError(failure(e));
                                    }
                                }}
                            >
                                Créer les tailles
                            </button>
                            <p>
                                Couleur de la dernière variante, ou noir si aucune. Les nouveaux
                                stocks sont à zéro pour vous laisser les renseigner.
                            </p>
                        </div>
                        <p className="admin-scope">
                            {variants.length}/100 variantes ·{" "}
                            {variants.reduce(
                                (sum, v) => sum + (/^\d+$/.test(v.stock) ? Number(v.stock) : 0),
                                0,
                            )}{" "}
                            unités saisies. Pour retirer une variante existante de la vente, mettez
                            son stock à zéro.
                        </p>
                        {variants.some((v) => isAmbiguousSize(v.size)) && <p role="status" className="admin-scope">
                            Une liste de pointures a été enregistrée comme une seule taille. Ces variantes sont exclues de la vente, sans effacer leur stock ni leur historique. Créez les pointures séparément et vérifiez le stock réel de chacune avant de le renseigner. Aucun stock n’est réparti automatiquement.
                        </p>}
                        {variants.map((v, index) => (
                            <fieldset
                                key={v.key}
                                className="admin-variant-fields product-variant-card"
                            >
                                <legend>
                                    Variante {index + 1} · {v.size || "Sans taille"}
                                </legend>
                                {isAmbiguousSize(v.size) && <p className="admin-muted">À corriger : plusieurs tailles dans la même variante — indisponible à la commande.</p>}
                                <div className="product-variant-tools">
                                    <span className="admin-tag">
                                        {v.id ? "Existante" : "Nouvelle"}
                                    </span>
                                    <button
                                        className="admin-text-button"
                                        type="button"
                                        disabled={variants.length >= 100}
                                        aria-label={`Dupliquer la variante ${index + 1}`}
                                        onClick={() =>
                                            setVariants((old) => [
                                                ...old,
                                                {
                                                    ...v,
                                                    key: crypto.randomUUID(),
                                                    id: undefined,
                                                    expectedStock: undefined,
                                                    sku: "",
                                                    stock: "0",
                                                },
                                            ])
                                        }
                                    >
                                        <Copy size={15} />
                                        Dupliquer
                                    </button>
                                    {!v.id && (
                                        <button
                                            className="admin-text-button"
                                            type="button"
                                            aria-label={`Retirer la variante ${index + 1}`}
                                            onClick={() =>
                                                setVariants((old) =>
                                                    old.filter((item) => item.key !== v.key),
                                                )
                                            }
                                        >
                                            <Trash2 size={15} />
                                            Retirer
                                        </button>
                                    )}
                                </div>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <label>
                                        Référence SKU
                                        <input
                                            className={inputClass}
                                            required
                                            maxLength={100}
                                            value={v.sku}
                                            onChange={(e) => variant(v.key, "sku", e.target.value)}
                                        />
                                    </label>
                                    <label>
                                        Taille (facultative)
                                        <input
                                            className={inputClass}
                                            maxLength={40}
                                            placeholder="Une taille : M ou 38 ou Unique"
                                            value={v.size}
                                            onChange={(e) => variant(v.key, "size", e.target.value)}
                                        />
                                    </label>
                                    <label>
                                        Stock disponible
                                        <input
                                            className={inputClass}
                                            required
                                            type="number"
                                            min="0"
                                            max="1000000"
                                            step="1"
                                            value={v.stock}
                                            aria-label={`Stock disponible de la variante ${index + 1}`}
                                            onChange={(e) =>
                                                variant(v.key, "stock", e.target.value)
                                            }
                                        />
                                        {v.expectedStock !== undefined && (
                                            <small>
                                                Au chargement : {v.expectedStock} ·{" "}
                                                {Number(v.stock) - v.expectedStock >= 0 ? "+" : ""}
                                                {Number(v.stock) - v.expectedStock} unité(s)
                                            </small>
                                        )}
                                    </label>
                                    <label>
                                        Couleur (code ou nom)
                                        <div className="product-color-field">
                                            {/^#[a-f\d]{6}$/i.test(v.color) && (
                                                <input
                                                    type="color"
                                                    aria-label={`Choisir la couleur de la variante ${index + 1}`}
                                                    value={v.color}
                                                    onChange={(e) =>
                                                        variant(v.key, "color", e.target.value)
                                                    }
                                                />
                                            )}
                                            <input
                                                className={inputClass}
                                                required
                                                maxLength={80}
                                                value={v.color}
                                                aria-label={`Code couleur de la variante ${index + 1}`}
                                                onChange={(e) =>
                                                    variant(v.key, "color", e.target.value)
                                                }
                                            />
                                        </div>
                                    </label>
                                    {(
                                        [
                                            ["colorNameFr", "Couleur français"],
                                            ["colorNameAr", "Couleur arabe"],
                                            ["colorNameEn", "Couleur anglais"],
                                        ] as const
                                    ).map(([key, label]) => (
                                        <label key={key}>
                                            {label}
                                            <input
                                                className={inputClass}
                                                required
                                                maxLength={80}
                                                dir={key === "colorNameAr" ? "rtl" : undefined}
                                                value={v[key]}
                                                onChange={(e) =>
                                                    variant(v.key, key, e.target.value)
                                                }
                                            />
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ))}
                        {!variants.length && (
                            <p className="admin-scope">
                                Aucune variante : ajoutez-en une pour gérer le stock et mettre en
                                vente.
                            </p>
                        )}
                        <button
                            type="button"
                            className="admin-button"
                            disabled={variants.length >= 100}
                            onClick={() => setVariants((old) => [...old, freshVariant()])}
                        >
                            <Plus size={16} />
                            Ajouter une variante
                        </button>
                    </fieldset>
                    <div className="product-editor-footer">
                        {error && <p className="admin-alert">{error}</p>}
                        <p>
                            {uploading
                                ? "Envoi des photos… Attendez la fin avant d’enregistrer."
                                : busy
                                  ? "Enregistrement en cours…"
                                  : dirty
                                    ? "Vos modifications seront appliquées ensemble à l’enregistrement."
                                    : "Aucune modification en attente."}
                        </p>
                        <div className="admin-editor-actions">
                            <button
                                type="submit"
                                className="admin-button primary"
                                disabled={disabled || uncertain}
                            >
                                {busy ? "En cours…" : "Enregistrer le produit"}
                            </button>
                            <button
                                type="button"
                                className="admin-button"
                                disabled={disabled}
                                onClick={() => {
                                    if (discard()) {
                                        setOpen(false);
                                        setError("");
                                        requestAnimationFrame(() => listTitle.current?.focus());
                                    }
                                }}
                            >
                                Fermer la fiche
                            </button>
                            {id || uncertain ? (
                                <button
                                    type="button"
                                    className="admin-text-button"
                                    disabled={disabled}
                                    onClick={() => refresh(true)}
                                >
                                    Recharger cette fiche
                                </button>
                            ) : null}
                        </div>
                    </div>
                </form>
            )}
            <section className="admin-panel">
                <div className="admin-toolbar">
                    <label className="admin-search">
                        <span>Rechercher un produit</span>
                        <div>
                            <Search size={17} />
                            <input
                                type="search"
                                value={search}
                                placeholder="Nom, adresse ou SKU"
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </label>
                    <label>
                        Publication
                        <select
                            value={publication}
                            onChange={(e) => setPublication(e.target.value)}
                        >
                            <option value="ALL">Tous les statuts</option>
                            <option value="ACTIVE">En vente</option>
                            <option value="DRAFT">Brouillons</option>
                            <option value="ARCHIVED">Archivés</option>
                        </select>
                    </label>
                </div>
                <div className="product-list-filters">
                    <label>
                        Stock
                        <select value={stock} onChange={(e) => setStock(e.target.value)}>
                            <option value="ALL">Tous les stocks</option>
                            <option value="LOW">Une variante à 3 unités ou moins</option>
                            <option value="OUT">Toutes les variantes épuisées</option>
                            <option value="NONE">Sans variante</option>
                        </select>
                    </label>
                    <label>
                        Trier par
                        <select value={sort} onChange={(e) => setSort(e.target.value)}>
                            <option value="recent">Ordre du catalogue</option>
                            <option value="name">Nom A–Z</option>
                            <option value="stock">Stock total croissant</option>
                        </select>
                    </label>
                    <button
                        type="button"
                        className="admin-text-button"
                        disabled={
                            !search && publication === "ALL" && stock === "ALL" && sort === "recent"
                        }
                        onClick={() => {
                            setSearch("");
                            setPublication("ALL");
                            setStock("ALL");
                            setSort("recent");
                        }}
                    >
                        Effacer les filtres
                    </button>
                </div>
                <p className="admin-result-count" role="status">
                    {visible.length} résultat{visible.length !== 1 ? "s" : ""}
                </p>
                <div className="admin-product-list">
                    {visible.map((p) => (
                        <article key={p.id}>
                            <div className="admin-product-thumb">
                                <AdminProductPhoto images={p.images} name={p.nameFr} />
                            </div>
                            <div className="admin-product-name">
                                <h3>{p.nameFr}</h3>
                                <p dir="rtl">{p.nameAr}</p>
                                <span>
                                    {p.category.nameFr} · /{p.slug}
                                </span>
                            </div>
                            <div className="admin-product-numbers">
                                <strong>{money(p.price)}</strong>
                                <span>
                                    {p.variants.reduce((sum, v) => sum + v.stock, 0)} unités ·{" "}
                                    {p.variants.length} variante(s)
                                </span>
                                {p.variants.some((v) => v.stock <= 3) && (
                                    <span className="product-low-stock">
                                        Vérifier les stocks par variante
                                    </span>
                                )}
                                {p.variants.some((v) => isAmbiguousSize(v.size)) && (
                                    <span className="product-low-stock">Pointures regroupées à corriger · exclues de la vente</span>
                                )}
                            </div>
                            <span className={`admin-status status-${p.status.toLowerCase()}`}>
                                {p.status === "ACTIVE"
                                    ? "En vente"
                                    : p.status === "DRAFT"
                                      ? "Brouillon"
                                      : "Archivé"}
                            </span>
                            <div className="admin-product-actions">
                                <button
                                    className="admin-button"
                                    disabled={disabled}
                                    aria-label={`Modifier ${p.nameFr}`}
                                    onClick={() => edit(p)}
                                >
                                    Modifier
                                </button>
                                <button
                                    className="admin-text-button"
                                    disabled={disabled || p.status === "ARCHIVED"}
                                    aria-label={`Archiver ${p.nameFr}`}
                                    onClick={async () => {
                                        if (
                                            lock.current ||
                                            (id === p.id && !discard()) ||
                                            !confirm(
                                                `Archiver « ${p.nameFr} » ? Le produit ne sera plus visible dans la boutique.`,
                                            )
                                        )
                                            return;
                                        lock.current = true;
                                        setBusy(true);
                                        setError("");
                                        try {
                                            const refreshed = await onDelete(p.id);
                                            if (id === p.id) setOpen(false);
                                            setSuccess(
                                                refreshed
                                                    ? "Produit archivé."
                                                    : "Produit archivé. Actualisez le catalogue pour voir le résultat.",
                                            );
                                        } catch (e) {
                                            setError(failure(e));
                                        } finally {
                                            lock.current = false;
                                            setBusy(false);
                                        }
                                    }}
                                >
                                    Archiver
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
                {!visible.length && (
                    <div className="admin-empty">
                        <Package size={28} />
                        <h3>Aucun produit trouvé</h3>
                        <p>Modifiez les filtres ou recherchez un autre nom.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
