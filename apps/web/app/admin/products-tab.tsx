"use client";
import { useAdminLocale } from "./admin-locale";

import { useEffect, useRef, useState } from "react";
import { isAmbiguousSize, productColorKey, validColorPhotos, type ProductColorPhoto } from "@imad-store/shared";
import { QuantityOfferEditor, packOffers, type DraftQuantityOffer } from "./quantity-offer-editor";
import { AdminProductPhoto } from "./admin-product-photo";
import { Plus, Search, Package, RefreshCw, Copy, Trash2 } from "lucide-react";
import { getAdminProductBySlug, type Product, type Category } from "@/lib/api";
import { ProductPhotos } from "./product-photos";
import { ProductPreview } from "./product-preview";
import { ProductRecommendationEditor } from "./product-recommendations";
import {
    type DraftVariant,
    productSlug,
    prepareNewVariantSkus,
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
    quantityDiscounts: [] as DraftQuantityOffer[],
    promotionEnabled: false,
    freeShipping: false,
    colorPhotos: [] as ProductColorPhoto[],
    recommendationSettings: {
        enabled: false,
        upsellProductIds: [] as string[],
        crossSellProductIds: [] as string[],
    },
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
    active?: boolean;
    products: Product[];
    total: number;
    categories: Category[];
    focusedProduct?: string;
    clearProductFocus: () => void;
    onRefresh: () => Promise<Product[]>;
    onCreate: (data: Record<string, unknown>) => Promise<boolean>;
    onUpdate: (id: string, data: Record<string, unknown>) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
};
type CreationRecovery = { slug: string; existing?: Product | null };
export function ProductsTab({
    active = true,
    products,
    total,
    categories,
    focusedProduct,
    clearProductFocus,
    onCreate,
    onUpdate,
    onDelete,
    onRefresh,
}: Props) {
    const { t, locale } = useAdminLocale();
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
    const [slugEdited, setSlugEdited] = useState(false);
    const [conflictField, setConflictField] = useState("");
    const [conflictAttempt, setConflictAttempt] = useState(0);
    const [busy, setBusy] = useState(false),
        [uploading, setUploading] = useState(false),
        [error, setError] = useState(""),
        [success, setSuccess] = useState(""),
        [uncertain, setUncertain] = useState(false),
        [sizes, setSizes] = useState(""),
        [session, setSession] = useState(0);
    const [creationRecovery, setCreationRecovery] = useState<CreationRecovery | null>(null);
    const title = useRef<HTMLHeadingElement>(null),
        listTitle = useRef<HTMLHeadingElement>(null),
        lock = useRef(false);
    const slugInput = useRef<HTMLInputElement>(null);
    const skuInputs = useRef(new Map<string, HTMLInputElement>());
    const disabled = busy || uploading,
        dirty = open && JSON.stringify({ form, variants, images }) !== baseline;
    const recoveredProduct = creationRecovery?.existing;
    const checkingRequired = creationRecovery !== null && recoveredProduct === undefined;
    const saveBlocked = uncertain || (creationRecovery !== null && recoveredProduct !== null);
    const summary = stockSummary(products);
    const photoColors = new Map(
        variants.filter((v) => !isAmbiguousSize(v.size)).map((v) => [productColorKey(v), v]),
    );
    const visible = products
        .filter(
            (p) => focusedProduct ? p.id === focusedProduct :
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
    useEffect(() => {
        if (disabled || !conflictField) return;
        const input =
            conflictField === "slug" ? slugInput.current : skuInputs.current.get(conflictField);
        input?.focus({ preventScroll: true });
        input?.scrollIntoView({ block: "center", behavior: "instant" });
    }, [conflictField, conflictAttempt, disabled]);
    function discard() {
        return (
            !dirty || confirm(t("Abandonner les modifications non enregistrées de cette fiche ?"))
        );
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
                  quantityDiscounts: (p.quantityDiscounts ?? []).map((tier) => ({
                      minQuantity: String(tier.minQuantity),
                      totalPrice: (tier.totalPrice ?? tier.unitPrice * tier.minQuantity).toFixed(2),
                  })),
                  promotionEnabled: Boolean(p.compareAtPrice && p.compareAtPrice > p.price),
                  freeShipping: Boolean(p.freeShipping),
                  colorPhotos: p.colorPhotos ?? [],
                  recommendationSettings: p.recommendationSettings ?? {
                      enabled: false,
                      upsellProductIds: [],
                      crossSellProductIds: [],
                  },
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
        setSlugEdited(Boolean(p));
        setVariants(nextVariants);
        setImages(nextImages);
        setBaseline(JSON.stringify({ form: next, variants: nextVariants, images: nextImages }));
        setOpen(true);
        setError("");
        setConflictField("");
        setSuccess("");
        setUncertain(false);
        setCreationRecovery(null);
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
    async function verifyCreation() {
        if (lock.current || disabled || !creationRecovery) return;
        lock.current = true;
        setBusy(true);
        setError("");
        try {
            const existing = await getAdminProductBySlug(creationRecovery.slug);
            setCreationRecovery({ ...creationRecovery, existing });
        } catch {
            setError("Vérification impossible. Vos saisies sont conservées. Réessayez la vérification.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (lock.current || disabled || saveBlocked) return;
        let data: Record<string, unknown>;
        setConflictField("");
        setConflictAttempt((attempt) => attempt + 1);
        try {
            const payload = variantPayload(prepareNewVariantSkus(variants, form.slug));
            const tiers = packOffers(Number(form.price), form.quantityDiscounts);
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug))
                throw new Error(
                    "L’adresse utilise uniquement des lettres minuscules sans accents, des chiffres et des tirets.",
                );
            const sameAddress = !creationRecovery && products.find((p) => p.id !== id && p.slug === form.slug);
            if (sameAddress) {
                setConflictField("slug");
                throw new Error(
                    `L’adresse « ${form.slug} » appartient déjà au produit « ${sameAddress.nameFr} ». Modifiez l’adresse pour un autre produit, ou ouvrez la fiche existante pour ajouter des variantes.`,
                );
            }
            for (const [index, v] of payload.entries()) {
                const owner = products.find((p) =>
                    p.slug !== creationRecovery?.slug &&
                    p.variants.some((saved) => saved.sku === v.sku && saved.id !== v.id),
                );
                if (!owner) continue;
                setConflictField(variants[index].key);
                throw new Error(
                    `Variante ${index + 1} : la référence « ${v.sku} » est déjà utilisée dans « ${owner.nameFr} ». Choisissez une autre référence ou laissez vide pour une nouvelle variante.`,
                );
            }
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
                nameEn: form.nameEn.trim() || form.nameFr.trim(),
                price: Number(form.price),
                quantityDiscounts: tiers,
                compareAtPrice:
                    form.promotionEnabled && form.compareAtPrice
                        ? Number(form.compareAtPrice)
                        : null,
                images,
                colorPhotos: validColorPhotos(form.colorPhotos, images, payload),
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
            const response = (e as { response?: { status: number; data?: { code?: string } } })
                .response;
            const status = response?.status;
            if (!id && (!response || status === 408 || (status ?? 0) >= 500 || (creationRecovery && status === 409))) {
                setCreationRecovery({ slug: form.slug });
                setError("Enregistrement non confirmé. Vérifiez cette adresse pour reprendre. Vos saisies sont conservées.");
                return;
            }
            if (response?.data?.code === "PRODUCT_SLUG_CONFLICT") {
                setConflictField("slug");
            }
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
                        {t("Produits et stocks")}
                    </h2>
                    <p>
                        {products.length}
                        {t(" fiches chargées sur ")}
                        {total}
                        {t(". Recherche, filtres et compteurs sur cette sélection (100 maximum).")}
                    </p>
                </div>
                <div className="product-heading-actions">
                    <button className="admin-button" disabled={disabled} onClick={() => refresh()}>
                        <RefreshCw size={16} />
                        {t("Actualiser")}
                    </button>
                    <button
                        className="admin-button primary"
                        disabled={disabled}
                        onClick={() => edit()}
                    >
                        <Plus size={17} />
                        {t("Ajouter un produit")}
                    </button>
                </div>
            </div>
            <div className="product-stock-summary">
                <div>
                    <span>{t("Produits en vente")}</span>
                    <strong>{summary.active}</strong>
                </div>
                <div>
                    <span>{t("Unités en vente")}</span>
                    <strong>{summary.units}</strong>
                </div>
                <div>
                    <span>{t("Variantes à 3 unités ou moins en vente")}</span>
                    <strong>{summary.low}</strong>
                </div>
            </div>
            {success && (
                <p className="admin-feedback" role="status">
                    {t(success)}
                </p>
            )}
            {error && (
                <p className="admin-alert" role="alert">
                    {t(error)}
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
                                {t("FICHE PRODUIT · ")}
                                {id ? t("MODIFICATION") : t("CRÉATION")}
                            </p>
                            <h3 ref={title} tabIndex={-1}>
                                {id ? t("Modifier le produit") : t("Nouveau produit")}
                            </h3>
                            <p className="admin-muted">
                                {t(
                                    "Préparez en brouillon, puis mettez en vente lorsque tout est prêt.",
                                )}
                            </p>
                        </div>
                        <div className="product-editor-heading-actions">
                            <span className="admin-tag">
                                {dirty ? t("Modifications non enregistrées") : t("Fiche chargée")}
                            </span>
                            <ProductPreview key={`preview-heading-${session}-${active}`}
                                draft={form} images={images} variants={variants} categories={categories}
                                disabled={busy} />
                        </div>
                    </div>
                    <nav
                        className="product-editor-nav"
                        aria-label={t("Sections de la fiche produit")}
                    >
                        <a href="#product-details">{t("1 · Informations")}</a>
                        <a href="#product-photos">{t("2 · Photos")}</a>
                        <a href="#product-pricing">{t("3 · Prix et offres")}</a>
                        <a href="#product-variants">{t("4 · Stock")}</a>
                        <a href="#product-recommendations">{t("5 · Recommandations")}</a>
                    </nav>
                    <aside className="product-editor-summary" aria-label={t("Résumé du produit")}>
                        <span className="admin-eyebrow">{t("APERÇU DE LA FICHE")}</span>
                        {images.length > 0 && (
                            <AdminProductPhoto
                                images={images}
                                name={form.nameFr || "Votre produit"}
                            />
                        )}
                        <h4>{form.nameFr || t("Votre nouveau produit")}</h4>
                        <p dir="rtl">{form.nameAr || t("Le nom arabe apparaîtra ici")}</p>
                        <strong>
                            {Number(form.price) > 0
                                ? money(Number(form.price))
                                : t("Prix à renseigner")}
                        </strong>
                        <small>{t("pour 1 pièce · hors livraison")}</small>
                        <ul>
                            {[
                                [
                                    "Informations principales",
                                    Boolean(
                                        form.nameFr.trim() &&
                                        form.nameAr.trim() &&
                                        form.slug &&
                                        form.categoryId,
                                    ),
                                ],
                                ["Prix d’une pièce", Number(form.price) > 0],
                                ["Photos", images.length > 0],
                                [
                                    "Variante en stock",
                                    variants.some(
                                        (v) => Number(v.stock) > 0 && !isAmbiguousSize(v.size),
                                    ),
                                ],
                            ].map(([label, ready]) => (
                                <li key={String(label)}>
                                    <span aria-hidden="true">{ready ? "✓" : "○"}</span>
                                    {t(String(label))}
                                    <small>{ready ? t("Renseigné") : t("À compléter")}</small>
                                </li>
                            ))}
                        </ul>
                        <p>
                            {form.status === "ACTIVE"
                                ? t(
                                      "En vente : une photo et une variante en stock sont nécessaires.",
                                  )
                                : t(
                                      "Vous pouvez enregistrer un brouillon et terminer les photos et le stock plus tard.",
                                  )}
                        </p>
                        <p>
                            {t(
                                "Le nom anglais et les noms de couleurs anglais reprennent le français lorsqu’ils sont laissés vides. Une référence est créée automatiquement pour chaque nouvelle variante sans SKU.",
                            )}
                        </p>
                    </aside>
                    <fieldset disabled={disabled} className="product-identity" id="product-details">
                        <legend>{t("1. Informations du produit")}</legend>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label>
                                {t("Nom français")}
                                <input
                                    dir="auto"
                                    className={inputClass}
                                    required
                                    maxLength={200}
                                    value={form.nameFr}
                                    onChange={(e) =>
                                        setForm((v) => ({
                                            ...v,
                                            nameFr: e.target.value,
                                            ...(!id && !slugEdited && !creationRecovery
                                                ? { slug: productSlug(e.target.value) }
                                                : {}),
                                        }))
                                    }
                                />
                            </label>
                            <label>
                                {t("Adresse du produit")}
                                <div className="product-slug-field">
                                    <input
                                        ref={slugInput}
                                        dir="auto"
                                        className={inputClass}
                                        required
                                        maxLength={160}
                                        value={form.slug}
                                        readOnly={Boolean(creationRecovery)}
                                        aria-label={t("Adresse du produit")}
                                        aria-invalid={conflictField === "slug" || undefined}
                                        placeholder={t("exemple-sac-beige")}
                                        onChange={(e) => {
                                            setSlugEdited(true);
                                            if (conflictField === "slug") {
                                                setConflictField("");
                                                setError("");
                                            }
                                            set("slug", e.target.value);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="admin-text-button"
                                        disabled={Boolean(creationRecovery)}
                                        onClick={() => set("slug", productSlug(form.nameFr))}
                                    >
                                        {t("Suggérer")}
                                    </button>
                                </div>
                            </label>
                            {(
                                [
                                    ["nameAr", "Nom arabe"],
                                    ["nameEn", "Nom anglais (facultatif)"],
                                ] as const
                            ).map(([key, label]) => (
                                <label key={key}>
                                    {t(String(label))}
                                    <input
                                        className={inputClass}
                                        dir={key === "nameAr" ? "rtl" : undefined}
                                        required={key !== "nameEn"}
                                        maxLength={200}
                                        value={form[key]}
                                        onChange={(e) => set(key, e.target.value)}
                                    />
                                </label>
                            ))}
                            <label>
                                {t("Catégorie")}
                                <select
                                    className={inputClass}
                                    required
                                    aria-label={t("Catégorie du produit")}
                                    value={form.categoryId}
                                    onChange={(e) => set("categoryId", e.target.value)}
                                >
                                    <option value="">{t("Choisir une catégorie")}</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nameFr}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                {t("Publication")}
                                <select
                                    className={inputClass}
                                    value={form.status}
                                    onChange={(e) => set("status", e.target.value)}
                                >
                                    <option value="DRAFT">{t("Brouillon")}</option>
                                    <option value="ACTIVE">{t("En vente")}</option>
                                    <option value="ARCHIVED">{t("Archivé")}</option>
                                </select>
                            </label>
                        </div>
                        <details className="product-descriptions">
                            <summary>{t("Descriptions et détails supplémentaires")}</summary>
                            {(["Fr", "Ar", "En"] as const).map((lang) => (
                                <label key={lang}>
                                    {t("Description ")}
                                    {lang}
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
                    <div id="product-photos" className="product-photos-section">
                        <ProductPhotos
                            key={session}
                            images={images}
                            onChange={setImages}
                            busy={disabled}
                            onBusy={setUploading}
                        />
                        <ProductPreview key={`preview-photos-${session}-${active}`}
                            draft={form} images={images} variants={variants} categories={categories}
                            disabled={busy} label="Prévisualiser les photos" />
                    </div>
                    <fieldset disabled={disabled} className="product-pricing" id="product-pricing">
                        <legend>{t("3. Prix et offres")}</legend>
                        <p className="admin-muted">
                            {t(
                                "Le prix d’une pièce est votre base. Les offres et la livraison sont facultatives.",
                            )}
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label>
                                {t("Prix de vente (MAD)")}
                                <input
                                    dir="auto"
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
                                    dir="auto"
                                    type="checkbox"
                                    checked={form.promotionEnabled}
                                    onChange={(e) =>
                                        setForm((v) => ({
                                            ...v,
                                            promotionEnabled: e.target.checked,
                                        }))
                                    }
                                />{" "}
                                {t("Produit en promotion")}
                            </label>
                            <label className="admin-option-check">
                                <input
                                    dir="auto"
                                    type="checkbox"
                                    checked={form.freeShipping}
                                    onChange={(e) =>
                                        setForm((v) => ({ ...v, freeShipping: e.target.checked }))
                                    }
                                />{" "}
                                {t("Livraison offerte pour tout panier contenant ce produit")}
                            </label>
                            <label>
                                {t("Prix initial barré (promotion)")}
                                <input
                                    dir="auto"
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
                        </div>
                        <QuantityOfferEditor
                            price={Number(form.price)}
                            offers={form.quantityDiscounts}
                            onChange={(offers) =>
                                setForm((v) => ({ ...v, quantityDiscounts: offers }))
                            }
                            disabled={disabled}
                        />
                    </fieldset>
                    <fieldset
                        disabled={disabled}
                        className="product-variants"
                        id="product-variants"
                    >
                        <legend>{t("4. Tailles, couleurs et stock")}</legend>
                        <p className="admin-muted">
                            {t(
                                "Chaque variante possède une référence SKU unique. Le stock correspond aux unités disponibles, après les réservations des commandes.",
                            )}
                        </p>
                        <div className="product-size-builder">
                            <label>
                                {t("Créer plusieurs tailles")}
                                <input
                                    dir="auto"
                                    className={inputClass}
                                    value={sizes}
                                    placeholder={t("S, M, L, XL")}
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
                                {t("Créer les tailles")}
                            </button>
                            <p>
                                {t(
                                    "Couleur de la dernière variante, ou noir si aucune. Les nouveaux stocks sont à zéro pour vous laisser les renseigner.",
                                )}
                            </p>
                        </div>
                        <p className="admin-scope">
                            {variants.length}
                            {t("/100 variantes ·")}{" "}
                            {variants.reduce(
                                (sum, v) => sum + (/^\d+$/.test(v.stock) ? Number(v.stock) : 0),
                                0,
                            )}{" "}
                            {t(
                                "unités saisies. Pour retirer une variante existante de la vente, mettez son stock à zéro.",
                            )}
                        </p>
                        {variants.some((v) => isAmbiguousSize(v.size)) && (
                            <p role="status" className="admin-scope">
                                {t(
                                    "Une liste de pointures a été enregistrée comme une seule taille. Ces variantes sont exclues de la vente, sans effacer leur stock ni leur historique. Créez les pointures séparément et vérifiez le stock réel de chacune avant de le renseigner. Aucun stock n’est réparti automatiquement.",
                                )}
                            </p>
                        )}
                        {variants.map((v, index) => (
                            <fieldset
                                key={v.key}
                                className="admin-variant-fields product-variant-card"
                            >
                                <legend>
                                    {t("Variante ")}
                                    {index + 1} · {v.size || t("Sans taille")}
                                </legend>
                                {isAmbiguousSize(v.size) && (
                                    <p className="admin-muted">
                                        {t(
                                            "À corriger : plusieurs tailles dans la même variante — indisponible à la commande.",
                                        )}
                                    </p>
                                )}
                                <div className="product-variant-tools">
                                    <span className="admin-tag">
                                        {v.id ? t("Existante") : t("Nouvelle")}
                                    </span>
                                    <button
                                        className="admin-text-button"
                                        type="button"
                                        disabled={variants.length >= 100}
                                        aria-label={t("Dupliquer la variante {0}", {
                                            "0": index + 1,
                                        })}
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
                                        {t("Dupliquer")}
                                    </button>
                                    {!v.id && (
                                        <button
                                            className="admin-text-button"
                                            type="button"
                                            aria-label={t("Retirer la variante {0}", {
                                                "0": index + 1,
                                            })}
                                            onClick={() =>
                                                setVariants((old) =>
                                                    old.filter((item) => item.key !== v.key),
                                                )
                                            }
                                        >
                                            <Trash2 size={15} />
                                            {t("Retirer")}
                                        </button>
                                    )}
                                </div>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <label>
                                        {t("Référence SKU")}
                                        <input
                                            ref={(element) => {
                                                if (element) skuInputs.current.set(v.key, element);
                                                else skuInputs.current.delete(v.key);
                                            }}
                                            dir="auto"
                                            className={inputClass}
                                            required={Boolean(v.id)}
                                            placeholder={t("Générée automatiquement si vide")}
                                            maxLength={100}
                                            value={v.sku}
                                            aria-label={t("Référence SKU")}
                                            aria-describedby={
                                                !v.id ? `sku-help-${v.key}` : undefined
                                            }
                                            aria-invalid={conflictField === v.key || undefined}
                                            onChange={(e) => {
                                                if (conflictField === v.key) {
                                                    setConflictField("");
                                                    setError("");
                                                }
                                                variant(v.key, "sku", e.target.value);
                                            }}
                                        />
                                        {!v.id && (
                                            <small id={`sku-help-${v.key}`}>
                                                {t(
                                                    "Laissez vide pour générer une référence unique. Chaque variante doit avoir sa propre référence dans le catalogue.",
                                                )}
                                            </small>
                                        )}
                                    </label>
                                    <label>
                                        {t("Taille (facultative)")}
                                        <input
                                            dir="auto"
                                            className={inputClass}
                                            maxLength={40}
                                            placeholder={t("Une taille : M ou 38 ou Unique")}
                                            value={v.size}
                                            onChange={(e) => variant(v.key, "size", e.target.value)}
                                        />
                                    </label>
                                    <label>
                                        {t("Stock disponible")}
                                        <input
                                            dir="auto"
                                            className={inputClass}
                                            required
                                            type="number"
                                            min="0"
                                            max="1000000"
                                            step="1"
                                            value={v.stock}
                                            aria-label={t("Stock disponible de la variante {0}", {
                                                "0": index + 1,
                                            })}
                                            onChange={(e) =>
                                                variant(v.key, "stock", e.target.value)
                                            }
                                        />
                                        {v.expectedStock !== undefined && (
                                            <small>
                                                {t("Au chargement : ")}
                                                {v.expectedStock} ·{" "}
                                                {Number(v.stock) - v.expectedStock >= 0 ? "+" : ""}
                                                {Number(v.stock) - v.expectedStock}
                                                {t(" unité(s)")}
                                            </small>
                                        )}
                                    </label>
                                    <label>
                                        {t("Couleur (code ou nom)")}
                                        <div className="product-color-field">
                                            {/^#[a-f\d]{6}$/i.test(v.color) && (
                                                <input
                                                    dir="auto"
                                                    type="color"
                                                    aria-label={t(
                                                        "Choisir la couleur de la variante {0}",
                                                        { "0": index + 1 },
                                                    )}
                                                    value={v.color}
                                                    onChange={(e) =>
                                                        variant(v.key, "color", e.target.value)
                                                    }
                                                />
                                            )}
                                            <input
                                                dir="auto"
                                                className={inputClass}
                                                required
                                                maxLength={80}
                                                value={v.color}
                                                aria-label={t("Code couleur de la variante {0}", {
                                                    "0": index + 1,
                                                })}
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
                                            {t(String(label))}
                                            <input
                                                className={inputClass}
                                                required={key !== "colorNameEn"}
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
                                {t(
                                    "Aucune variante : ajoutez-en une pour gérer le stock et mettre en vente.",
                                )}
                            </p>
                        )}
                        <button
                            type="button"
                            className="admin-button"
                            disabled={variants.length >= 100}
                            onClick={() => setVariants((old) => [...old, freshVariant()])}
                        >
                            <Plus size={16} />
                            {t("Ajouter une variante")}
                        </button>
                    </fieldset>
                    {photoColors.size > 0 && (
                        <fieldset className="admin-variant-fields" disabled={disabled || !images.length}>
                            <legend>{t("Photo par couleur")}</legend>
                            <p className="admin-muted">
                                {t(images.length
                                    ? "Choisissez une photo de la galerie pour chaque couleur. Elle s’affichera sur la fiche produit quand cette couleur est sélectionnée."
                                    : "Ajoutez d’abord des photos à la galerie pour les associer aux couleurs.")}
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                                {[...photoColors].map(([key, color]) => {
                                    const name = (locale === "ar" ? color.colorNameAr : color.colorNameFr).trim()
                                        || color.colorNameFr.trim() || color.color.trim() || t("Couleur");
                                    const selected = form.colorPhotos.find(
                                        (link) => link.colorKey === key && images.includes(link.image),
                                    )?.image;
                                    return (
                                        <div key={key} className="flex items-end gap-3">
                                            <label className="min-w-0 flex-1">
                                                {t("Photo pour {0}", { "0": name })}
                                                <select
                                                    className={inputClass}
                                                    value={selected ?? ""}
                                                    onChange={(e) => {
                                                        const image = e.target.value;
                                                        setForm((old) => ({
                                                            ...old,
                                                            colorPhotos: [
                                                                ...old.colorPhotos.filter((link) => link.colorKey !== key),
                                                                ...(image ? [{ colorKey: key, image }] : []),
                                                            ],
                                                        }));
                                                    }}
                                                >
                                                    <option value="">{t("Par défaut · photo de couverture")}</option>
                                                    {images.map((image, index) => (
                                                        <option key={`${image}-${index}`} value={image}>
                                                            {index === 0 ? t("Couverture") : t("Photo {0}", { "0": index + 1 })}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            {selected && (
                                                <span className="shrink-0 overflow-hidden rounded-md">
                                                    <AdminProductPhoto images={[selected]} name={name} width={44} height={44} />
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </fieldset>
                    )}
                    <ProductRecommendationEditor
                        key={`recommendations-${session}`}
                        currentId={id}
                        value={form.recommendationSettings}
                        products={products}
                        disabled={disabled}
                        onChange={(recommendationSettings) =>
                            setForm((old) => ({ ...old, recommendationSettings }))
                        }
                    />
                    <div className="product-editor-footer">
                        {error && <p className="admin-alert">{t(error)}</p>}
                        {recoveredProduct === null && !error && (
                            <p role="status">{t("Aucune fiche trouvée à cette adresse. Vous pouvez réessayer avec la même saisie.")}</p>
                        )}
                        {recoveredProduct && (
                            <p role="status">{t("Une fiche existe déjà à cette adresse. Vos saisies restent dans ce formulaire.")}</p>
                        )}
                        <p>
                            {uploading
                                ? t("Envoi des photos… Attendez la fin avant d’enregistrer.")
                                : busy && checkingRequired
                                  ? t("Vérification en cours…")
                                : busy
                                  ? t("Enregistrement en cours…")
                                  : dirty
                                    ? t(
                                          "Vos modifications seront appliquées ensemble à l’enregistrement.",
                                      )
                                    : t("Aucune modification en attente.")}
                        </p>
                        <div className="admin-editor-actions">
                            <button
                                type="submit"
                                className="admin-button primary"
                                disabled={disabled || saveBlocked}
                            >
                                {busy ? t("En cours…") : t("Enregistrer le produit")}
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
                                {t("Fermer la fiche")}
                            </button>
                            {id || uncertain ? (
                                <button
                                    type="button"
                                    className="admin-text-button"
                                    disabled={disabled}
                                    onClick={() => refresh(true)}
                                >
                                    {t("Recharger cette fiche")}
                                </button>
                            ) : null}
                            {checkingRequired && (
                                <button type="button" className="admin-button" disabled={disabled} onClick={verifyCreation}>
                                    {t("Vérifier l’enregistrement")}
                                </button>
                            )}
                            {recoveredProduct && (
                                <button
                                    type="button"
                                    className="admin-button"
                                    disabled={disabled}
                                    onClick={() => edit(recoveredProduct)}
                                >
                                    {t("Ouvrir la fiche existante")}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            )}
            <section className="admin-panel">
                {focusedProduct ? (
                    <div className="admin-panel-heading">
                        <h2>{t("Produit sélectionné dans le stock")}</h2>
                        <button type="button" className="admin-button" onClick={clearProductFocus}>
                            {t("Afficher tous les produits")}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="admin-toolbar">
                            <label className="admin-search">
                                <span>{t("Rechercher un produit")}</span>
                                <div>
                                    <Search size={17} />
                                    <input
                                        dir="auto"
                                        type="search"
                                        value={search}
                                        placeholder={t("Nom, adresse ou SKU")}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </label>
                            <label>
                                {t("Publication")}
                                <select
                                    value={publication}
                                    onChange={(e) => setPublication(e.target.value)}
                                >
                                    <option value="ALL">{t("Tous les statuts")}</option>
                                    <option value="ACTIVE">{t("En vente")}</option>
                                    <option value="DRAFT">{t("Brouillons")}</option>
                                    <option value="ARCHIVED">{t("Archivés")}</option>
                                </select>
                            </label>
                        </div>
                        <div className="product-list-filters">
                            <label>
                                {t("Stock")}
                                <select value={stock} onChange={(e) => setStock(e.target.value)}>
                                    <option value="ALL">{t("Tous les stocks")}</option>
                                    <option value="LOW">{t("Une variante à 3 unités ou moins")}</option>
                                    <option value="OUT">{t("Toutes les variantes épuisées")}</option>
                                    <option value="NONE">{t("Sans variante")}</option>
                                </select>
                            </label>
                            <label>
                                {t("Trier par")}
                                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                                    <option value="recent">{t("Ordre du catalogue")}</option>
                                    <option value="name">{t("Nom A–Z")}</option>
                                    <option value="stock">{t("Stock total croissant")}</option>
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
                                {t("Effacer les filtres")}
                            </button>
                        </div>
                    </>
                )}
                <p className="admin-result-count" role="status">
                    {visible.length}
                    {t(" résultat")}
                    {visible.length !== 1 ? t("s") : ""}
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
                                    {p.variants.reduce((sum, v) => sum + v.stock, 0)}
                                    {t(" unités ·")} {p.variants.length}
                                    {t(" variante(s)")}
                                </span>
                                {p.variants.some((v) => v.stock <= 3) && (
                                    <span className="product-low-stock">
                                        {t("Vérifier les stocks par variante")}
                                    </span>
                                )}
                                {p.variants.some((v) => isAmbiguousSize(v.size)) && (
                                    <span className="product-low-stock">
                                        {t("Pointures regroupées à corriger · exclues de la vente")}
                                    </span>
                                )}
                            </div>
                            <span className={`admin-status status-${p.status.toLowerCase()}`}>
                                {p.status === "ACTIVE"
                                    ? t("En vente")
                                    : p.status === "DRAFT"
                                      ? t("Brouillon")
                                      : t("Archivé")}
                            </span>
                            <div className="admin-product-actions">
                                <button
                                    className="admin-button"
                                    disabled={disabled}
                                    aria-label={t("Modifier {0}", { "0": p.nameFr })}
                                    onClick={() => edit(p)}
                                >
                                    {t("Modifier")}
                                </button>
                                <button
                                    className="admin-text-button"
                                    disabled={disabled || p.status === "ARCHIVED"}
                                    aria-label={t("Archiver {0}", { "0": p.nameFr })}
                                    onClick={async () => {
                                        if (
                                            lock.current ||
                                            (id === p.id && !discard()) ||
                                            !confirm(
                                                t(
                                                    "Archiver « {name} » ? Le produit ne sera plus visible dans la boutique.",
                                                    { name: p.nameFr },
                                                ),
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
                                    {t("Archiver")}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
                {!visible.length && (
                    <div className="admin-empty">
                        <Package size={28} />
                        <h3>{t("Aucun produit trouvé")}</h3>
                        <p>{t("Modifiez les filtres ou recherchez un autre nom.")}</p>
                    </div>
                )}
            </section>
        </div>
    );
}
