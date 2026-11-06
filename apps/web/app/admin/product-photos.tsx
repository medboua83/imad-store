"use client";
import { useAdminLocale } from "./admin-locale";

import { useRef, useState } from "react";
import { ImagePlus, ArrowLeft, ArrowRight, Star, X } from "lucide-react";
import { uploadProductImage } from "@/lib/api";
import { AdminProductPhoto } from "./admin-product-photo";
import { validatePhoto } from "./product-utils";
export function ProductPhotos({
    images,
    onChange,
    busy,
    onBusy,
}: {
    images: string[];
    onChange: (images: string[]) => void;
    busy: boolean;
    onBusy: (value: boolean) => void;
}) {
    const { t } = useAdminLocale();
    const [progress, setProgress] = useState(""),
        [failures, setFailures] = useState<string[]>([]),
        [dragging, setDragging] = useState(false);
    const lock = useRef(false);
    async function upload(files: File[]) {
        if (lock.current || busy || !files.length) return;
        lock.current = true;
        onBusy(true);
        setFailures([]);
        let duplicates = 0;
        const result = [...images],
            errors: string[] = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i],
                    invalid = validatePhoto(file, 12 - result.length);
                if (invalid) {
                    errors.push(`${file.name} : ${invalid}`);
                    continue;
                }
                setProgress(`Envoi ${i + 1}/${files.length} : ${file.name}`);
                try {
                    const url = await uploadProductImage(file);
                    if (result.includes(url)) {
                        duplicates++;
                        continue;
                    }
                    result.push(url);
                    onChange([...result]);
                } catch {
                    errors.push(
                        `${file.name} : envoi échoué. Sélectionnez ce fichier pour réessayer.`,
                    );
                }
            }
        } finally {
            setFailures(errors);
            setProgress(
                `${result.length - images.length} photo(s) ajoutée(s). ${duplicates ? `${duplicates} doublon(s) ignoré(s). ` : ""}Enregistrez la fiche pour conserver cet ordre.`,
            );
            lock.current = false;
            onBusy(false);
        }
    }
    function move(index: number, target: number) {
        const next = [...images];
        const [url] = next.splice(index, 1);
        next.splice(target, 0, url);
        onChange(next);
    }
    return (
        <fieldset className="product-photos">
            <legend>{t("2. Photos du produit")}</legend>
            <p className="admin-muted">
                {t(
                    "La première photo est la couverture. Jusqu’à 12 photos · PNG, JPEG ou WebP · 5 Mo par fichier.",
                )}
            </p>
            <div
                className={`product-photo-drop ${dragging ? "dragging" : ""}`}
                role="group"
                aria-label={t("Zone d’ajout de photos")}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void upload(Array.from(e.dataTransfer.files));
                }}
            >
                <ImagePlus size={28} aria-hidden="true" />
                <strong>{t("Déposez vos photos ici")}</strong>
                <span>{t("ou choisissez plusieurs fichiers sur votre appareil")}</span>
                <label>
                    {t("Choisir des photos")}
                    <input
                        dir="auto"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        disabled={busy || images.length >= 12}
                        onChange={(e) => {
                            const input = e.currentTarget;
                            void upload(Array.from(input.files || []));
                            input.value = "";
                        }}
                    />
                </label>
            </div>
            {progress && (
                <p className="admin-feedback" role="status">
                    {t(progress)}
                </p>
            )}
            {failures.length > 0 && (
                <div className="admin-alert" role="alert">
                    <p>{t("Les autres photos ajoutées sont conservées.")}</p>
                    <ul>
                        {failures.map((message, i) => (
                            <li key={i}>{t(message)}</li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="product-photo-grid">
                {images.map((url, i) => (
                    <div key={`${url}-${i}`} className="product-photo-card">
                        <AdminProductPhoto
                            images={[url]}
                            name={t("Vue {number} du produit", { number: i + 1 })}
                            width={160}
                            height={160}
                        />
                        <span className="product-photo-position">
                            {i === 0 ? t("Couverture") : t("Photo {0}", { "0": i + 1 })}
                        </span>
                        <div className="product-photo-actions">
                            <button
                                type="button"
                                disabled={busy || i === 0}
                                aria-label={t("Déplacer la photo {0} vers la gauche", {
                                    "0": i + 1,
                                })}
                                onClick={() => move(i, i - 1)}
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <button
                                type="button"
                                disabled={busy || i === images.length - 1}
                                aria-label={t("Déplacer la photo {0} vers la droite", {
                                    "0": i + 1,
                                })}
                                onClick={() => move(i, i + 1)}
                            >
                                <ArrowRight size={16} />
                            </button>
                            <button
                                type="button"
                                disabled={busy || i === 0}
                                aria-label={t("Utiliser la photo {0} comme couverture", {
                                    "0": i + 1,
                                })}
                                onClick={() => move(i, 0)}
                            >
                                <Star size={16} />
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                aria-label={t("Retirer la photo {0}", { "0": i + 1 })}
                                onClick={() => onChange(images.filter((_, index) => index !== i))}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {!images.length && (
                <p className="admin-scope">
                    {t("Aucune photo ajoutée. Vous pouvez préparer le produit en brouillon.")}
                </p>
            )}
            <p className="admin-scope">
                {t(
                    "L’ordre et les retraits sont appliqués à la fiche lors de l’enregistrement. Retirer une photo ne supprime pas son fichier du serveur.",
                )}
            </p>
        </fieldset>
    );
}
