"use client";
import { measurementKeys, type MeasurementBasis, type ProductInformation } from "@imad-store/shared";
import { useAdminLocale } from "./admin-locale";
const labels = { chest: ["Tour de poitrine", "محيط الصدر"], waist: ["Tour de taille", "محيط الخصر"], hips: ["Tour de hanches", "محيط الورك"], length: ["Longueur", "الطول"], footLength: ["Longueur du pied", "طول القدم"] };
export function ProductInformationEditor({ value, sizes, disabled, onChange }: { value: ProductInformation; sizes: string[]; disabled: boolean; onChange: (value: ProductInformation) => void }) {
    const { locale } = useAdminLocale();
    const text = (fr: string, ar: string) => locale === "ar" ? ar : fr;
    const sizeOptions = sizes.filter((size, index) => sizes.findIndex(candidate => candidate.toLowerCase() === size.toLowerCase()) === index);
    const guide = value.sizeGuide ?? { basis: "BODY" as MeasurementBasis, verified: false, rows: [] };
    const columns = measurementKeys.filter(key => guide.basis === "FOOT" ? key === "footLength" : key !== "footLength");
    const updateGuide = (change: Partial<typeof guide>) => onChange({ ...value, sizeGuide: { ...guide, ...change } });
    return <fieldset className="product-information-editor" disabled={disabled}>
        <legend>{text("Informations et guide des tailles", "معلومات المنتج ودليل المقاسات")}</legend>
        <p>{text("Renseignez uniquement les caractéristiques réelles de ce modèle. Les champs vides ne créent aucune promesse publique.", "أدخلوا الخصائص الفعلية لهذا الموديل فقط. لا تتحول الحقول الفارغة إلى معلومات منشورة.")}</p>
        {([ ["composition", "Composition / matière", "الخامة والتركيب"], ["fit", "Coupe et détails", "القصة والتفاصيل"], ["care", "Entretien selon l’étiquette", "العناية حسب الملصق"] ] as const).map(([key, fr, ar]) => <label key={key}>{text(fr, ar)}<textarea dir="auto" maxLength={2000} value={value[key] ?? ""} onChange={e => onChange({ ...value, [key]: e.target.value })}/></label>)}
        <label>{text("Type de mesures (cm)", "نوع القياسات (cm)")}<select value={guide.basis} disabled={guide.rows.length > 0 || disabled} onChange={e => updateGuide({ basis: e.target.value as MeasurementBasis, verified: false })}>
            <option value="BODY">{text("Corps : tours complets", "الجسم: المحيط الكامل")}</option><option value="GARMENT">{text("Vêtement : tours complets et longueur", "القطعة: المحيط الكامل والطول")}</option><option value="FOOT">{text("Pied : longueur", "القدم: الطول")}</option>
        </select></label>
        <p>{text("Mesurez chaque taille de ce modèle. Les tours sont des circonférences complètes, pas des largeurs à plat. Pour changer le type, retirez d’abord les lignes existantes.", "قيسوا كل مقاس لهذا الموديل. المحيط كامل وليس عرض القطعة مسطحة. لتغيير النوع، احذفوا الأسطر الموجودة أولاً.")}</p>
        {guide.rows.map((row, index) => <fieldset className="measurement-editor-row" key={index}><legend>{text("Mesure", "قياس")} {index + 1}</legend>
            <label>{text("Taille", "المقاس")}<select aria-label={`${text("Taille mesure", "مقاس القياس")} ${index + 1}`} value={row.size} onChange={e => updateGuide({ verified: false, rows: guide.rows.map((entry, i) => i === index ? { ...entry, size: e.target.value } : entry) })}><option value="">—</option>{[...new Set([...sizeOptions, row.size].filter(Boolean))].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
            {columns.map(key => <label key={key}>{key === "length" ? guide.basis === "BODY" ? text("Stature du corps", "القامة") : text("Longueur du vêtement", "طول القطعة") : text(labels[key][0], labels[key][1])} · cm<input type="number" min="0.1" max={key === "footLength" ? 100 : 400} step="any" value={row[key] ?? ""} onChange={e => updateGuide({ verified: false, rows: guide.rows.map((entry, i) => i === index ? { ...entry, [key]: e.target.value === "" ? undefined : Number(e.target.value) } : entry) })}/></label>)}
            <button type="button" className="admin-button" onClick={() => updateGuide({ verified: false, rows: guide.rows.filter((_, i) => i !== index) })}>{text("Retirer cette mesure", "حذف هذا القياس")}</button>
        </fieldset>)}
        <button type="button" className="admin-button" disabled={guide.rows.length >= 50 || !sizeOptions.some(size => !guide.rows.some(row => row.size.toLowerCase() === size.toLowerCase()))} onClick={() => updateGuide({ verified: false, rows: [...guide.rows, { size: sizeOptions.find(size => !guide.rows.some(row => row.size.toLowerCase() === size.toLowerCase())) ?? "" }] })}>{text("Ajouter une ligne de mesures", "إضافة سطر قياسات")}</button>
        <label><input type="checkbox" disabled={disabled || !guide.rows.length} checked={guide.verified} onChange={e => updateGuide({ verified: e.target.checked })}/>{text("Je confirme ces mesures pour ce modèle : publier le tableau", "أؤكد هذه القياسات لهذا الموديل: نشر الجدول")}</label>
        <p>{text("Toute modification des mesures retire cette validation. Sans validation, le site affiche les conseils de mesure sans chiffres.", "أي تغيير في القياسات يلغي التحقق. دون تأكيدها، يعرض الموقع إرشادات القياس بدون أرقام.")}</p>
    </fieldset>;
}
