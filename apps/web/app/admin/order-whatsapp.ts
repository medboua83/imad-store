import type { AdminOrder } from "@/lib/api";
import { productVariantImages } from "@imad-store/shared";
import { money } from "./admin-utils";
import { orderAmounts } from "./order-utils";

// Click-to-chat prepares a draft only; it never sends or confirms an order.
export function orderWhatsAppLink(order: AdminOrder, origin: string): string | null {
    const raw = (order.customerPhone || order.phone || order.address?.phone || "").trim();
    let phone = raw.replace(/[\s().-]/g, "");
    if (/^0[5-7]\d{8}$/.test(phone)) phone = `212${phone.slice(1)}`;
    else phone = phone.replace(/^00/, "").replace(/^\+/, "");
    if (!/^[1-9]\d{7,14}$/.test(phone)) return null;

    const amounts = orderAmounts(order);
    const lines = [
        `Bonjour ${order.customerName || order.fullName || order.address?.fullName || ""},`.replace(" ,", ","),
        `Voici le récapitulatif de votre commande nº ${order.id} :`,
        "",
    ];
    for (const item of order.items ?? []) {
        const variant = item.variant;
        lines.push(`• ${item.product?.nameFr || item.product?.nameAr || item.product?.nameEn || "Article indisponible"}`);
        if (variant?.size) lines.push(`Taille : ${variant.size}`);
        const color = variant?.colorNameFr || variant?.colorNameAr || variant?.colorNameEn || variant?.color;
        if (color) lines.push(`Couleur : ${color}`);
        if (variant?.sku) lines.push(`Référence produit : ${variant.sku}`);
        lines.push(`Quantité : ${item.quantity} · Prix unitaire : ${money(item.unitPrice)}`);
        lines.push(`Total article : ${money(item.quantity * item.unitPrice)}`);
        const image = productVariantImages(
            { images: item.product?.images ?? [], colorPhotos: item.product?.colorPhotos },
            variant ? { color: variant.color ?? "", colorNameFr: variant.colorNameFr ?? "", colorNameAr: variant.colorNameAr ?? "", colorNameEn: variant.colorNameEn ?? "" } : undefined,
        )[0];
        if (image) {
            try {
                const url = new URL(image, origin);
                if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password)
                    lines.push(`Photo du produit : ${url.href}`);
            } catch { /* Missing/invalid images do not prevent contacting the customer. */ }
        }
        lines.push("");
    }
    if (!order.items?.length) lines.push("Articles : détail non disponible.");
    if (order.items?.length) lines.push(`Sous-total des articles : ${money(amounts.subtotal)}`);
    lines.push(`Frais de livraison : ${amounts.shipping == null ? "non renseignés (à vérifier)" : money(amounts.shipping)}`);
    lines.push(`Total de la commande : ${money(order.totalAmount)}`);
    if (!amounts.reconciled) lines.push("Le total enregistré fait foi ; le détail des montants reste à vérifier.");
    const address = [order.street || order.address?.street, order.city || order.address?.city,
        order.region || order.address?.region, order.postalCode || order.address?.postalCode].filter(Boolean);
    lines.push(`Adresse de livraison : ${address.join(", ") || "non renseignée"}`);
    lines.push(`Téléphone : ${raw}`);
    if (order.paymentMethod === "COD") lines.push("Paiement à la livraison.");
    if (order.notes) lines.push(`Note de votre commande : ${order.notes}`);
    lines.push("", "Pouvez-vous confirmer ces informations et la livraison ?");
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}
