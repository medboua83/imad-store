"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { Plus, Search, Package } from "lucide-react";
import { Product, Category, uploadProductImage } from "@/lib/api";

type Variant = {
    id?: string;
    expectedStock?: number;
    color: string;
    colorNameFr: string;
    colorNameAr: string;
    colorNameEn: string;
    size: string;
    stock: number;
    sku: string;
};
const newVariant = (): Variant => ({
    color: "#000000",
    colorNameFr: "Noir",
    colorNameAr: "أسود",
    colorNameEn: "Black",
    size: "",
    stock: 0,
    sku: "",
});
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
    categoryId: "",
    status: "DRAFT",
};
export function ProductsTab({
    products,
    total,
    categories,
    onCreate,
    onUpdate,
    onDelete,
}: {
    products: Product[];
    total: number;
    categories: Category[];
    onCreate: (data: Record<string, unknown>) => Promise<void>;
    onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");
    const [publication, setPublication] = useState("ALL");
    const editorTitle = useRef<HTMLHeadingElement>(null);
    const visibleProducts = products.filter(
        (p) =>
            (publication === "ALL" || p.status === publication) &&
            [p.nameFr, p.nameAr, p.nameEn, p.slug, ...p.variants.map((v) => v.sku)].some((v) =>
                v.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
            ),
    );
    const [open, setOpen] = useState(false),
        [id, setId] = useState<string | null>(null),
        [form, setForm] = useState(blank);
    const [variants, setVariants] = useState<Variant[]>([]),
        [images, setImages] = useState<string[]>([]);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    const edit = (product?: Product) => {
        setId(product?.id || null);
        setError("");
        setSuccess("");
        setOpen(true);
        requestAnimationFrame(() => {
            editorTitle.current?.scrollIntoView({ block: "start", behavior: "smooth" });
            editorTitle.current?.focus({ preventScroll: true });
        });
        setForm(
            product
                ? {
                      ...blank,
                      ...product,
                      price: String(product.price),
                      compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
                      categoryId: product.category.id,
                  }
                : blank,
        );
        setImages(product?.images || []);
        setVariants(
            product
                ? product.variants.map((v) => ({
                      ...v,
                      size: v.size || "",
                      expectedStock: v.stock,
                  }))
                : [newVariant()],
        );
    };
    const message = (e: unknown) => {
        const failure = e as {
            response?: { data?: { error?: string; details?: { path: string; message: string }[] } };
        };
        return (
            failure.response?.data?.details?.map((d) => `${d.path} : ${d.message}`).join(" · ") ||
            failure.response?.data?.error ||
            "Impossible d’enregistrer. Réessayez."
        );
    };
    const inputClass = "admin-field";
    const set = (key: keyof typeof blank, value: string) =>
        setForm((previous) => ({ ...previous, [key]: value }));
    const changeVariant = (index: number, key: keyof Variant, value: string | number) =>
        setVariants((previous) =>
            previous.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
        );
    return (
        <div className="space-y-5 admin-products">
            <div className="admin-panel-heading">
                <div>
                    <h2>Votre catalogue</h2>
                    <p>
                        {products.length} fiches chargées sur {total}. Recherche sur cette
                        sélection.
                    </p>
                </div>
                <button className="admin-button primary" onClick={() => edit()}>
                    <Plus size={18} aria-hidden="true" /> Ajouter un produit
                </button>
            </div>
            {success && (
                <p className="admin-feedback" role="status">
                    {success}
                </p>
            )}
            {error && (
                <p role="alert" className="admin-alert">
                    {error}
                </p>
            )}
            {open && (
                <form
                    className="space-y-4 admin-panel admin-product-editor"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        setError("");
                        try {
                            const data = {
                                ...form,
                                price: Number(form.price),
                                compareAtPrice: form.compareAtPrice
                                    ? Number(form.compareAtPrice)
                                    : null,
                                images,
                                variants,
                            };
                            if (id) await onUpdate(id, data);
                            else await onCreate(data);
                            setOpen(false);
                            setSuccess("Produit enregistré. Le catalogue est à jour.");
                        } catch (failure) {
                            setError(message(failure));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <h3 ref={editorTitle} tabIndex={-1}>
                        {id ? "Modifier le produit" : "Nouveau produit"}
                    </h3>
                    <p className="admin-muted">
                        Complétez la fiche, ajoutez vos photos et vérifiez les variantes. Le statut
                        Brouillon permet de préparer un produit sans le mettre en vente.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                        {(
                            [
                                ["slug", "Adresse du produit"],
                                ["nameFr", "Nom français"],
                                ["nameAr", "Nom arabe"],
                                ["nameEn", "Nom anglais"],
                            ] as const
                        ).map(([key, label]) => (
                            <label key={key}>
                                {label}
                                <input
                                    className={inputClass}
                                    required
                                    value={form[key]}
                                    dir={key === "nameAr" ? "rtl" : undefined}
                                    onChange={(e) => set(key, e.target.value)}
                                />
                            </label>
                        ))}
                        <label>
                            Prix (MAD)
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
                        <label>
                            Ancien prix (MAD)
                            <input
                                className={inputClass}
                                type="number"
                                min="0.01"
                                step="0.01"
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
                    {(["Fr", "Ar", "En"] as const).map((lang) => (
                        <label className="block" key={lang}>
                            Description {lang}
                            <textarea
                                className={inputClass}
                                dir={lang === "Ar" ? "rtl" : undefined}
                                value={form[`description${lang}`]}
                                onChange={(e) => set(`description${lang}`, e.target.value)}
                            />
                        </label>
                    ))}
                    <fieldset className="space-y-3">
                        <legend>Photos du produit</legend>
                        <p className="admin-muted">
                            PNG, JPEG ou WebP, 5 Mo maximum. Ajoutez une vraie photo avant de
                            publier.
                        </p>
                        <label>
                            Ajouter des photos
                            <input
                                className="block"
                                disabled={busy || images.length >= 12}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                multiple
                                onChange={async (e) => {
                                    const files = Array.from(e.target.files || []);
                                    setBusy(true);
                                    setError("");
                                    try {
                                        if (files.length + images.length > 12)
                                            throw new Error("Maximum 12 photos");
                                        for (const file of files) {
                                            if (file.size > 5 * 1024 * 1024)
                                                throw new Error("Image trop volumineuse");
                                            const url = await uploadProductImage(file);
                                            setImages((old) => [...old, url]);
                                        }
                                    } catch (failure) {
                                        setError(
                                            failure instanceof Error && !("response" in failure)
                                                ? failure.message
                                                : message(failure),
                                        );
                                    } finally {
                                        setBusy(false);
                                        e.target.value = "";
                                    }
                                }}
                            />
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {images.map((url, i) => (
                                <div key={`${url}-${i}`}>
                                    <img
                                        src={url}
                                        alt={`Vue du produit ${i + 1}`}
                                        className="h-24 w-24 rounded object-cover"
                                    />
                                    <button
                                        type="button"
                                        aria-label={`Retirer la photo ${i + 1}`}
                                        onClick={() =>
                                            setImages((old) =>
                                                old.filter((_, index) => index !== i),
                                            )
                                        }
                                    >
                                        Retirer
                                    </button>
                                </div>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset className="space-y-3">
                        <legend>Variantes et stock</legend>
                        <p className="admin-muted">
                            Pour retirer une variante existante de la vente, mettez son stock à
                            zéro.
                        </p>
                        {variants.map((v, index) => (
                            <fieldset
                                key={v.id || index}
                                className="admin-variant-fields grid gap-3 p-4 md:grid-cols-3"
                            >
                                <legend>Variante {index + 1}</legend>
                                {(
                                    [
                                        "sku",
                                        "color",
                                        "colorNameFr",
                                        "colorNameAr",
                                        "colorNameEn",
                                        "size",
                                    ] as const
                                ).map((key, i) => (
                                    <label key={key}>
                                        {
                                            [
                                                "Référence SKU",
                                                "Couleur (code)",
                                                "Couleur français",
                                                "Couleur arabe",
                                                "Couleur anglais",
                                                "Taille",
                                            ][i]
                                        }
                                        <input
                                            className={inputClass}
                                            required={key !== "size"}
                                            value={v[key]}
                                            onChange={(e) =>
                                                changeVariant(index, key, e.target.value)
                                            }
                                        />
                                    </label>
                                ))}
                                <label>
                                    Stock
                                    <input
                                        className={inputClass}
                                        type="number"
                                        required
                                        min="0"
                                        max="1000000"
                                        step="1"
                                        value={v.stock}
                                        onChange={(e) =>
                                            changeVariant(index, "stock", Number(e.target.value))
                                        }
                                    />
                                </label>
                                {!v.id && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setVariants((old) => old.filter((_, i) => i !== index))
                                        }
                                    >
                                        Retirer cette variante
                                    </button>
                                )}
                            </fieldset>
                        ))}
                        <button
                            type="button"
                            className="underline"
                            onClick={() => setVariants((old) => [...old, newVariant()])}
                        >
                            Ajouter une variante
                        </button>
                    </fieldset>
                    <div className="admin-editor-actions">
                        <button disabled={busy} type="submit" className="admin-button primary">
                            {busy ? "En cours…" : "Enregistrer"}
                        </button>
                        <button type="button" disabled={busy} onClick={() => setOpen(false)}>
                            Annuler
                        </button>
                    </div>
                </form>
            )}
            <div className="admin-panel">
                <div className="admin-toolbar">
                    <label className="admin-search">
                        <span>Rechercher un produit</span>
                        <div>
                            <Search size={17} aria-hidden="true" />
                            <input
                                type="search"
                                value={search}
                                placeholder="Nom, adresse ou référence SKU"
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
                    <button
                        className="admin-text-button"
                        disabled={!search && publication === "ALL"}
                        onClick={() => {
                            setSearch("");
                            setPublication("ALL");
                        }}
                    >
                        Effacer les filtres
                    </button>
                </div>
                <p className="admin-result-count" role="status">
                    {visibleProducts.length} résultat{visibleProducts.length !== 1 ? "s" : ""}
                </p>
                <div className="admin-product-list">
                    {visibleProducts.length ? (
                        visibleProducts.map((p) => (
                            <article key={p.id}>
                                <div className="admin-product-thumb">
                                    {p.images[0] ? (
                                        <Image
                                            src={p.images[0]}
                                            alt={p.nameFr}
                                            width={64}
                                            height={76}
                                        />
                                    ) : (
                                        <Package size={24} aria-hidden="true" />
                                    )}
                                </div>
                                <div className="admin-product-name">
                                    <h3>{p.nameFr}</h3>
                                    <p dir="rtl">{p.nameAr}</p>
                                    <span>
                                        {p.category.nameFr} · /{p.slug}
                                    </span>
                                </div>
                                <div className="admin-product-numbers">
                                    <strong>{p.price.toFixed(2)} MAD</strong>
                                    <span>
                                        {p.variants.reduce((sum, v) => sum + v.stock, 0)} unités ·{" "}
                                        {p.variants.length} variante(s)
                                    </span>
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
                                        aria-label={`Modifier ${p.nameFr}`}
                                        disabled={busy}
                                        onClick={() => edit(p)}
                                    >
                                        Modifier
                                    </button>
                                    <button
                                        className="admin-text-button"
                                        aria-label={`Archiver ${p.nameFr}`}
                                        disabled={busy || p.status === "ARCHIVED"}
                                        onClick={async () => {
                                            if (
                                                confirm(
                                                    `Archiver « ${p.nameFr} » ? Le produit ne sera plus visible dans le magasin.`,
                                                )
                                            ) {
                                                try {
                                                    setBusy(true);
                                                    await onDelete(p.id);
                                                    setSuccess("Produit archivé.");
                                                } catch (failure) {
                                                    setError(message(failure));
                                                } finally {
                                                    setBusy(false);
                                                }
                                            }
                                        }}
                                    >
                                        Archiver
                                    </button>
                                </div>
                            </article>
                        ))
                    ) : (
                        <div className="admin-empty">
                            <Package size={30} />
                            <h3>Aucun produit trouvé</h3>
                            <p>Essayez un autre nom ou un autre statut.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
