"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Monitor, Smartphone, X } from "lucide-react";
import { isAmbiguousSize, productColorKey, type ProductColorPhoto } from "@imad-store/shared";
import type { Category } from "@/lib/api";
import { ProductPhoto } from "@/components/store/ProductPhoto";
import { AdminProductPhoto } from "./admin-product-photo";
import { useAdminLocale } from "./admin-locale";
import { money } from "./admin-utils";
import type { DraftVariant } from "./product-utils";

type PreviewDraft = {
    nameFr: string;
    nameAr: string;
    descriptionFr: string;
    descriptionAr: string;
    price: string;
    compareAtPrice: string;
    promotionEnabled: boolean;
    freeShipping: boolean;
    categoryId: string;
    colorPhotos: ProductColorPhoto[];
};

/** Reads the current form only: no product, cart, tracking or publication requests. */
export function ProductPreview({
    draft, images, variants, categories, label = "Prévisualiser le produit", disabled = false,
}: {
    draft: PreviewDraft;
    images: string[];
    variants: DraftVariant[];
    categories: Category[];
    label?: string;
    disabled?: boolean;
}) {
    const { t } = useAdminLocale();
    const [open, setOpen] = useState(false);
    const [layout, setLayout] = useState("mobile");
    const [selected, setSelected] = useState("");
    const [selectedColor, setSelectedColor] = useState("");
    const id = useId();
    const dialog = useRef<HTMLDialogElement>(null);
    const thumbnails = useRef<HTMLDivElement>(null);
    const gallery = [...new Set(images.filter(Boolean))];
    const index = Math.max(0, gallery.indexOf(selected));
    const image = gallery[index];
    const name = draft.nameAr.trim() || draft.nameFr.trim() || t("Votre nouveau produit");
    const description = draft.descriptionAr.trim() || draft.descriptionFr.trim();
    const price = Number(draft.price);
    const priceReady = draft.price.trim() !== "" && Number.isFinite(price) && price > 0;
    const compareAt = Number(draft.compareAtPrice);
    const hasPromotion = priceReady && draft.promotionEnabled && Number.isFinite(compareAt) && compareAt > price;
    const category = categories.find((category) => category.id === draft.categoryId);
    const validVariants = variants.filter((variant) => !isAmbiguousSize(variant.size));
    const colors = [...new Map(validVariants.filter((variant) =>
        variant.color.trim() || variant.colorNameAr.trim() || variant.colorNameFr.trim(),
    ).map((variant) => [productColorKey(variant), variant])).entries()];
    const sizes = [...new Set(validVariants.map((variant) => variant.size.trim()).filter(Boolean))];

    useEffect(() => {
        const element = dialog.current;
        if (open && element && !element.open) element.showModal();
        if (!open && element?.open) element.close();
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const strip = thumbnails.current;
        const current = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (!strip || !current) return;
        const viewport = strip.getBoundingClientRect(), item = current.getBoundingClientRect();
        const left = item.left < viewport.left ? item.left - viewport.left
            : item.right > viewport.right ? item.right - viewport.right : 0;
        if (left) strip.scrollBy({ left, behavior: "instant" });
    }, [open, image]);
    function move(offset: number) {
        if (gallery.length > 1) setSelected(gallery[(index + offset + gallery.length) % gallery.length]);
    }
    function show() {
        setSelected(gallery[0] || "");
        setSelectedColor("");
        setOpen(true);
    }
    return (
        <div className="product-preview-launcher">
            <button type="button" className="admin-button" disabled={disabled}
                aria-haspopup="dialog" aria-controls={id} onClick={show}>
                <Eye size={18} aria-hidden="true" />{t(label)}
            </button>
            <dialog ref={dialog} id={id} className="product-preview-dialog"
                aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`}
                onCancel={(event) => { event.preventDefault(); setOpen(false); }}
                onKeyDown={(event) => {
                    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
                    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
                }}>
                {open && <>
                    <header className="product-preview-header">
                        <div>
                            <h2 id={`${id}-title`}>{t("Prévisualisation du produit")}</h2>
                            <p id={`${id}-help`}>{t("Vérifiez votre saisie avant d’enregistrer. Cet aperçu ne publie pas le produit.")}</p>
                        </div>
                        <button type="button" className="admin-icon-button"
                            aria-label={t("Fermer la prévisualisation")} onClick={() => setOpen(false)}>
                            <X size={22} aria-hidden="true" />
                        </button>
                    </header>
                    <div className="product-preview-formats" role="group" aria-label={t("Format de prévisualisation")}>
                        <button type="button" aria-pressed={layout === "mobile"} onClick={() => setLayout("mobile")}>
                            <Smartphone size={17} aria-hidden="true" />{t("Mobile")}
                        </button>
                        <button type="button" aria-pressed={layout === "desktop"} onClick={() => setLayout("desktop")}>
                            <Monitor size={17} aria-hidden="true" />{t("Ordinateur")}
                        </button>
                    </div>
                    <article className="product-publication-preview" data-layout={layout}>
                        <div className="product-preview-media">
                            <div className="product-preview-photo">
                                <AdminProductPhoto key={image || "empty"} images={image ? [image] : []}
                                    name={image ? t("{name} — photo {number}", { name, number: index + 1 }) : name}
                                    width={1000} height={1250} eager />
                                {image && <span className="product-preview-position">
                                    {index === 0 ? t("Couverture") : t("Photo {0}", { "0": index + 1 })}
                                </span>}
                            </div>
                            {gallery.length > 1 && <>
                                <div className="product-preview-paging" dir="ltr">
                                    <button type="button" aria-label={t("Photo précédente")} onClick={() => move(-1)}>
                                        <ChevronLeft size={22} aria-hidden="true" />
                                    </button>
                                    <span role="status">{index + 1} / {gallery.length}</span>
                                    <button type="button" aria-label={t("Photo suivante")} onClick={() => move(1)}>
                                        <ChevronRight size={22} aria-hidden="true" />
                                    </button>
                                </div>
                                <div ref={thumbnails} className="product-preview-thumbnails" dir="ltr"
                                    role="group" aria-label={t("Photos de la prévisualisation")}>
                                    {gallery.map((src, position) => <button type="button" key={src}
                                        aria-label={t("Prévisualiser la photo {number}", { number: position + 1 })}
                                        aria-pressed={position === index} onClick={() => setSelected(src)}>
                                        <ProductPhoto images={[src]} name="" thumbnail sizes="56px" className="object-contain" />
                                        <span className="product-preview-thumbnail-number">{position + 1}</span>
                                    </button>)}
                                </div>
                            </>}
                            {!gallery.length && <p className="admin-muted">{t("Ajoutez une photo pour voir son rendu ici.")}</p>}
                        </div>
                        <div className="product-preview-content" dir="rtl">
                            <p className="product-preview-brand">IMAD MODE</p>
                            {category && <p>{category.nameAr || category.nameFr}</p>}
                            <h3 dir="auto">{name}</h3>
                            {draft.nameFr.trim() && draft.nameFr.trim() !== name && <p dir="auto">{draft.nameFr}</p>}
                            <div className="product-preview-price" dir="ltr">
                                {hasPromotion && <del>{money(compareAt)}</del>}
                                <strong>{priceReady ? money(price) : t("Prix à renseigner")}</strong>
                            </div>
                            <small>{t("pour 1 pièce · hors livraison")}</small>
                            {draft.freeShipping && <p className="admin-tag">{t("Livraison offerte")}</p>}
                            {colors.length > 0 && <div className="product-preview-colors" role="group" aria-label={t("Photos par couleur")}>
                                {colors.map(([key, variant]) => <button type="button" key={key}
                                    aria-pressed={selectedColor === key} onClick={() => {
                                        setSelectedColor(key);
                                        const match = draft.colorPhotos.find((entry) => entry.colorKey === key && gallery.includes(entry.image));
                                        setSelected(match?.image || gallery[0] || "");
                                    }}>
                                    {/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(variant.color) && <i style={{ backgroundColor: variant.color }} aria-hidden="true" />}
                                    {variant.colorNameAr || variant.colorNameFr || variant.color}
                                </button>)}
                            </div>}
                            {sizes.length > 0 && <div className="product-preview-sizes" aria-label={t("Tailles du produit")}>
                                {sizes.map((size) => <bdi key={size}>{size}</bdi>)}
                            </div>}
                            {description && <p className="product-preview-description" dir="auto">{description}</p>}
                        </div>
                    </article>
                    <footer className="product-preview-footer">
                        <button type="button" className="admin-button primary" onClick={() => setOpen(false)}>
                            {t("Revenir à la fiche")}
                        </button>
                    </footer>
                </>}
            </dialog>
        </div>
    );
}
