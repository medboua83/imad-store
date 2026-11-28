import { Prisma } from "@prisma/client";
import { CAMPAIGN_FIELDS, campaignTags } from "@imad-store/shared";
import { privateCampaign } from "./campaign-attribution";
import { olivraisonStatusLabels } from "@imad-store/shared";

export const ORDER_EXPORT_LIMIT = 10000;
export const orderExportSelect = {
    campaignAttribution: true, campaignAttributionExpiresAt: true,
    id: true, createdAt: true, customerName: true, fullName: true, customerPhone: true,
    phone: true, customerEmail: true, city: true, street: true, status: true,
    paymentStatus: true, paymentMethod: true, totalAmount: true, shippingCost: true,
    items: { select: { quantity: true, unitPrice: true,
        product: { select: { nameFr: true, nameAr: true } },
        variant: { select: { sku: true, size: true, colorNameFr: true, colorNameAr: true } },
    } },
} satisfies Prisma.OrderSelect;
type ExportOrder = Prisma.OrderGetPayload<{ select: typeof orderExportSelect }>;
type Tracking = { trackingId: string | null; carrierStatus: string | null; state: string; lastSyncedAt: Date | null };
const columns = [
    ["Référence", "المرجع"], ["Identifiant complet", "المعرف الكامل"],
    ["Date de création (UTC)", "تاريخ الإنشاء (UTC)"], ["Client", "الزبون"],
    ["Téléphone", "الهاتف"], ["E-mail", "البريد الإلكتروني"], ["Ville", "المدينة"],
    ["Adresse", "العنوان"], ["Statut de commande", "حالة الطلب"],
    ["Statut de paiement", "حالة الدفع"], ["Méthode de paiement", "طريقة الدفع"],
    ["Total enregistré", "الإجمالي المسجل"], ["Livraison enregistrée", "التوصيل المسجل"],
    ["Devise", "العملة"], ["Articles et variantes", "المنتجات والخيارات"],
    ["Numéro de suivi", "رقم التتبع"], ["Statut Olivraison", "حالة Olivraison"],
    ["État du suivi", "حالة التتبع"], ["Dernière vérification (UTC)", "آخر تحقق (UTC)"],
    ...CAMPAIGN_FIELDS.map(key => [key, key]),
    ["Modèle attribution", "نموذج الإسناد"], ["Arrivée publicitaire (UTC)", "الوصول الإعلاني (UTC)"],
    ["Consentement publicitaire (UTC)", "الموافقة الإعلانية (UTC)"], ["Notice publicitaire", "إشعار الإعلانات"],
];
/** Quote separators/newlines and neutralize spreadsheet formulas, including leading whitespace. */
export function csvCell(value: unknown, preserveText = false) {
    let text = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
    // Identifiers and phone numbers must retain leading zeroes and long digit sequences.
    if (text && (preserveText || /^[\s\u200b-\u200f\u202a-\u202e\u2066-\u2069]*[=+@-]/u.test(text))) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}
export function orderCsv(orders: ExportOrder[], tracking: Map<string, Tracking>, locale: "fr" | "ar") {
    const index = locale === "ar" ? 1 : 0;
    const lines = [columns.map(labels => csvCell(labels[index])).join(";")];
    for (const o of orders) {
        const shipment = tracking.get(o.id);
        const items = o.items.map(item => {
            const name = (locale === "ar" ? item.product?.nameAr : item.product?.nameFr) || item.product?.nameFr || item.product?.nameAr || "";
            const color = (locale === "ar" ? item.variant?.colorNameAr : item.variant?.colorNameFr) || item.variant?.colorNameFr || item.variant?.colorNameAr;
            return [name, color, item.variant?.size, item.variant?.sku,
                `${item.quantity} × ${item.unitPrice.toFixed(2)} MAD`].filter(Boolean).join(" · ");
        }).join("\n");
        const carrier = shipment?.carrierStatus;
        const touch = privateCampaign(o).campaignAttribution as { tags?: unknown; model?: string; capturedAt?: number; consentAt?: number; consentVersion?: string } | null;
        const tags = campaignTags(touch?.tags);
        // Payment remains the stored payment state, never inferred from delivery.
        lines.push([
            "#" + o.id.slice(-8).toUpperCase(), o.id, o.createdAt.toISOString(),
            o.customerName || o.fullName, o.customerPhone || o.phone, o.customerEmail,
            o.city, o.street, o.status, o.paymentStatus, o.paymentMethod,
            o.totalAmount.toFixed(2), o.shippingCost === null ? "" : o.shippingCost.toFixed(2), "MAD", items,
            shipment?.trackingId, carrier ? `${carrier} · ${olivraisonStatusLabels[carrier] || carrier}` : "",
            shipment?.state, shipment?.lastSyncedAt?.toISOString(),
            ...CAMPAIGN_FIELDS.map(key => tags[key]), touch?.model,
            touch?.capturedAt ? new Date(touch.capturedAt).toISOString() : "",
            touch?.consentAt ? new Date(touch.consentAt).toISOString() : "", touch?.consentVersion,
        ].map((value, column) => csvCell(value, column === 1 || column === 4 || column === 15 || (column >= 19 && column <= 27))).join(";"));
    }
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
