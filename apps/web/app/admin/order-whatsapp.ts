import type { AdminOrder } from "@/lib/api";
import { productVariantImages } from "@imad-store/shared";
import { orderAmounts } from "./order-utils";
const money = (amount: number) => `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} درهم`;

// Click-to-chat prepares a draft only; it never sends or confirms an order.
export function orderWhatsAppLink(order: AdminOrder, origin: string): string | null {
    const raw = (order.customerPhone || order.phone || order.address?.phone || "").trim();
    let phone = raw.replace(/[\s().-]/g, "");
    if (/^0[5-7]\d{8}$/.test(phone)) phone = `212${phone.slice(1)}`;
    else phone = phone.replace(/^00/, "").replace(/^\+/, "");
    if (!/^[1-9]\d{7,14}$/.test(phone)) return null;

    const amounts = orderAmounts(order);
    const lines = [
        `الإسم : ${order.customerName || order.fullName || order.address?.fullName || "غير متوفر"}`,
        "",
    ];
    for (const item of order.items ?? []) {
        const variant = item.variant;
        lines.push(`نوع المنتج : ${item.product?.nameAr || item.product?.nameFr || item.product?.nameEn || "منتج غير متوفر"}`);
        if (variant?.size) lines.push(`المقاس : ${variant.size}`);
        const color = variant?.colorNameAr || variant?.colorNameFr || variant?.colorNameEn || variant?.color;
        if (color) lines.push(`اللون : ${color}`);
        lines.push(`الكمية : ${item.quantity}`);
        lines.push(`ثمن المنتج : ${money(item.quantity * item.unitPrice)}`);
        const image = productVariantImages(
            { images: item.product?.images ?? [], colorPhotos: item.product?.colorPhotos },
            variant ? { color: variant.color ?? "", colorNameFr: variant.colorNameFr ?? "", colorNameAr: variant.colorNameAr ?? "", colorNameEn: variant.colorNameEn ?? "" } : undefined,
        )[0];
        if (image) {
            try {
                const url = new URL(image, origin);
                if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password)
                    lines.push(`صورة المنتج : ${url.href}`);
            } catch { /* Missing/invalid images do not prevent contacting the customer. */ }
        }
        lines.push("");
    }
    if (!order.items?.length) lines.push("تفاصيل المنتجات غير متوفرة.");
    if (order.items?.length) lines.push(`ثمن المنتجات : ${money(amounts.subtotal)}`);
    lines.push(`ثمن التوصيل : ${amounts.shipping == null ? "غير محدد (يرجى التحقق)" : money(amounts.shipping)}`);
    lines.push(`المجموع : ${money(order.totalAmount)}`);
    if (!amounts.reconciled) lines.push("المجموع المعتمد هو المبلغ المسجل؛ يرجى التحقق من تفاصيل المبالغ.");
    const closing = order.status === "CANCELLED"
        ? "هذا الطلب ملغى. تواصلوا معنا إذا احتجتم إلى المساعدة."
        : order.status === "DELIVERED"
          ? "تم تسجيل طلبكم كمُسلَّم. نحن رهن إشارتكم لأي استفسار."
          : order.status === "SHIPPED"
            ? "تم شحن طلبكم. تواصلوا معنا لأي استفسار بخصوص التوصيل."
            : order.confirmationMethod === "SITE" || order.status === "CONFIRMED"
              ? "طلبكم مؤكد. نتواصل معكم بخصوص التوصيل فقط؛ يرجى إبلاغنا بأي ملاحظة."
              : "هل تؤكدون الطلب بهذه المعلومات والمبلغ شامل التوصيل؟";
    lines.push("", closing);
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}
