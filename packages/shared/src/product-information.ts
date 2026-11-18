export type MeasurementBasis = "BODY" | "GARMENT" | "FOOT";
export const measurementKeys = ["chest", "waist", "hips", "length", "footLength"] as const;
export type MeasurementKey = typeof measurementKeys[number];
export type SizeMeasurement = { size: string } & Partial<Record<MeasurementKey, number>>;
export type ProductInformation = {
    composition?: string;
    care?: string;
    fit?: string;
    sizeGuide?: { basis: MeasurementBasis; verified: boolean; rows: SizeMeasurement[] };
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
/** Shared by the editor and API; measurements are supplied by the merchant, never inferred. */
export function productInformationError(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (!object(value) || Object.keys(value).some(key => !["composition", "care", "fit", "sizeGuide"].includes(key))) return "Informations produit invalides.";
    for (const key of ["composition", "care", "fit"]) {
        if (value[key] !== undefined && (typeof value[key] !== "string" || (value[key] as string).length > 2000)) return "Texte produit : 2 000 caractères maximum.";
    }
    if (value.sizeGuide === undefined) return null;
    const guide = value.sizeGuide;
    if (!object(guide) || Object.keys(guide).some(key => !["basis", "verified", "rows"].includes(key)) || !["BODY", "GARMENT", "FOOT"].includes(String(guide.basis)) || typeof guide.verified !== "boolean" || !Array.isArray(guide.rows) || guide.rows.length > 50 || (guide.verified && !guide.rows.length)) return "Guide : précisez le type et au moins une ligne pour publier des mesures vérifiées (50 maximum).";
    const seen = new Set<string>();
    for (const row of guide.rows) {
        if (!object(row) || Object.keys(row).some(key => !["size", ...measurementKeys].includes(key as MeasurementKey)) || typeof row.size !== "string" || !row.size.trim() || row.size.length > 40) return "Chaque ligne doit avoir une taille unique et des mesures en cm.";
        const size = row.size.trim().toLowerCase();
        if (seen.has(size)) return "Une seule ligne de mesures par taille.";
        seen.add(size);
        let count = 0;
        for (const key of measurementKeys) {
            if (row[key] === undefined) continue;
            if ((guide.basis === "FOOT") !== (key === "footLength")) return "Séparez les mesures du pied de celles des vêtements.";
            if (typeof row[key] !== "number" || !Number.isFinite(row[key]) || row[key] <= 0 || row[key] > (key === "footLength" ? 100 : 400)) return "Mesures en cm : valeurs positives, jusqu’à 400 (100 pour le pied).";
            count++;
        }
        if (!count) return "Renseignez au moins une mesure pour chaque taille.";
    }
    return null;
}
export function publicProductInformation(value: unknown): ProductInformation | null {
    if (!value || productInformationError(value)) return null;
    const info = value as ProductInformation;
    return { ...info, sizeGuide: info.sizeGuide?.verified ? info.sizeGuide : undefined };
}
