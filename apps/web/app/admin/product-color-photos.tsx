"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ImagePlus, X } from "lucide-react";
import { isAmbiguousSize, productColorKey, type ProductColorPhoto } from "@imad-store/shared";
import { ProductPhoto } from "@/components/store/ProductPhoto";
import { useAdminLocale } from "./admin-locale";
import type { DraftVariant } from "./product-utils";

export function ProductColorPhotos({ images, variants, value, disabled, onChange }: {
    images: string[];
    variants: DraftVariant[];
    value: ProductColorPhoto[];
    disabled: boolean;
    onChange: (value: ProductColorPhoto[]) => void;
}) {
    const { t, locale } = useAdminLocale();
    const [expanded, setExpanded] = useState("");
    const id = useId();
    const openers = useRef(new Map<string, HTMLButtonElement>());
    const gallery = [...new Set(images)];
    const colors = [...new Map(variants.filter(v => !isAmbiguousSize(v.size) &&
        (v.color.trim() || v.colorNameFr.trim() || v.colorNameAr.trim() || v.colorNameEn.trim()))
        .map(v => [productColorKey(v), v])).entries()];
    const assigned = (key: string) => value.find(link => link.colorKey === key && gallery.includes(link.image))?.image;
    const linked = colors.filter(([key]) => assigned(key)).length;
    function close(key: string) {
        setExpanded("");
        openers.current.get(key)?.focus();
    }
    function escape(event: KeyboardEvent<HTMLButtonElement>, key: string) {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(key); }
    }
    return <fieldset id="product-color-photos" className="product-color-photos" disabled={disabled}>
        <legend>{t("Photos et couleurs")}</legend>
        <p className="admin-muted">{t("Choisissez visuellement une photo pour chaque couleur. La même association s’applique à toutes ses tailles.")}</p>
        <p className="color-photo-summary" role="status">
            {t("{linked} sur {total} couleurs avec une photo", { linked, total: colors.length })}
        </p>
        {!colors.length && <p className="admin-scope">{t("Ajoutez les couleurs dans les variantes pour leur associer une photo.")}</p>}
        {!gallery.length && <p className="admin-scope">{t("Ajoutez d’abord des photos à la galerie pour les associer aux couleurs.")}</p>}
        <div className="color-photo-cards">
            {colors.map(([key, color], index) => {
                const name = (locale === "ar" ? color.colorNameAr : color.colorNameFr).trim()
                    || color.colorNameFr.trim() || color.colorNameEn.trim() || color.color.trim() || t("Couleur");
                const image = assigned(key);
                const photoIndex = image ? gallery.indexOf(image) : -1;
                const panelId = `${id}-${index}`;
                return <section key={key} className="color-photo-card" aria-label={t("Photo pour {0}", { "0": name })}>
                    <div className="color-photo-card-heading">
                        <span className="color-photo-current">
                            {image ? <ProductPhoto images={[image]} name={name} thumbnail sizes="72px" className="object-contain" />
                                : <ImagePlus size={26} aria-hidden="true" />}
                        </span>
                        <div>
                            <h4 dir="auto">
                                {/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(color.color) && <i style={{ backgroundColor: color.color }} aria-hidden="true" />}
                                {name}
                            </h4>
                            <p className={image ? "color-photo-linked" : "color-photo-missing"}>
                                {image ? <><Check size={15} aria-hidden="true" />{t("Photo {number} associée", { number: photoIndex + 1 })}</> : t("Photo à associer")}
                            </p>
                        </div>
                    </div>
                    {!image && <p className="admin-muted">{t("Sans association, cette couleur affiche la couverture.")}</p>}
                    <button type="button" className="admin-button" disabled={!gallery.length}
                        ref={node => { if (node) openers.current.set(key, node); else openers.current.delete(key); }}
                        aria-label={t("Choisir une photo pour {name}", { name })}
                        aria-expanded={expanded === key && gallery.length > 0} aria-controls={panelId}
                        onKeyDown={event => escape(event, key)}
                        onClick={() => setExpanded(expanded === key ? "" : key)}>
                        <ImagePlus size={17} aria-hidden="true" />{t(image ? "Changer la photo" : "Choisir une photo")}
                    </button>
                    <div id={panelId} className="color-photo-picker" hidden={expanded !== key || !gallery.length}>
                        {expanded === key && gallery.length > 0 && <><div className="color-photo-picker-heading">
                            <strong>{t("Photos pour {name}", { name })}</strong>
                            <button type="button" className="admin-icon-button" aria-label={t("Fermer le choix de photo pour {name}", { name })}
                                onKeyDown={event => escape(event, key)}
                                onClick={() => close(key)}><X size={18} aria-hidden="true" /></button>
                        </div>
                        <div className="color-photo-choice-grid" role="group" aria-label={t("Photos disponibles pour {name}", { name })}>
                            {gallery.map((src, position) => <button type="button" key={src}
                                aria-label={t("Associer la photo {number} à {name}", { number: position + 1, name })}
                                aria-pressed={src === image}
                                onKeyDown={event => escape(event, key)}
                                onClick={() => onChange([...value.filter(link => link.colorKey !== key), { colorKey: key, image: src }])}>
                                <span className="color-photo-choice-image"><ProductPhoto images={[src]} name="" thumbnail sizes="90px" className="object-contain" /></span>
                                <span>{position === 0 ? t("Couverture") : t("Photo {0}", { "0": position + 1 })}</span>
                                {src === image && <Check size={16} aria-hidden="true" />}
                            </button>)}
                        </div></>}
                    </div>
                    {image && <button type="button" className="admin-text-button color-photo-clear"
                        aria-label={t("Effacer l’association de {name}", { name })}
                        onClick={() => onChange(value.filter(link => link.colorKey !== key))}>
                        {t("Effacer l’association")}
                    </button>}
                </section>;
            })}
        </div>
        <p className="admin-scope">{t("Prévisualisez la fiche pour vérifier les couleurs, puis enregistrez le produit pour appliquer les associations.")}</p>
    </fieldset>;
}
